import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, LessThanOrEqual, MoreThan, Repository } from 'typeorm';

import { TripRequest } from '@modules/core/entities/trip-request.entity';
import { TripRequestPool } from '@modules/core/entities/trip-request-pool.entity';
import { Driver } from '@modules/core/entities/driver.entity';
import { Trip } from '@modules/core/entities/trip.entity';

import { NotificationService } from '@modules/notification/services/notification.service';
import { PagedDto } from '@shared/interface/paged.interface';
import {
  NotificationType,
  TripPoolStatus,
  TripRequestStatus,
  PreferredTime,
  PREFERRED_TIME_SLOT_TO_TIME,
  PREFERRED_TIME_SLOT_TO_RANGE,
} from 'src/types/enums';
import {
  isInterStateTrip,
  resolveNigeriaState,
} from '@shared/utils/geo/nigeria-geo.util';
import { BoardQueryDto, ClaimPoolDto } from '../dtos/trip-matching.dto';
import { ExpoService } from '@modules/notification/services/expo.service';
import { User } from '@modules/core/entities/user.entity';

/** Lead times (hours) for pushing a pooled request to the driver board. */
const INTRA_STATE_WINDOW_HOURS = 12; // within a state
const INTER_STATE_WINDOW_HOURS = 18; // across states
const DEFAULT_DEPARTURE_TIME = '06:00:00';

@Injectable()
export class TripMatchingService {
  private readonly logger = new Logger(TripMatchingService.name);

  constructor(
    private readonly entityManager: EntityManager,
    private readonly notificationService: NotificationService,
    private readonly expoService: ExpoService,
    @InjectRepository(TripRequestPool)
    private readonly poolRepo: Repository<TripRequestPool>,
    @InjectRepository(TripRequest)
    private readonly requestRepo: Repository<TripRequest>,
    @InjectRepository(Driver)
    private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Trip)
    private readonly tripRepo: Repository<Trip>,
      @InjectRepository(User) private readonly userRepo: Repository<User>,

  ) {}

  // ════════════════════════════════════════════════════════════════════════
  // 1. MATCHING — group pending requests on the same route + date into pools
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Sweep every PENDING request that isn't in a pool yet and group them by
   * route + date. Requests already dispatched to the board are never disturbed.
   * Safe to run repeatedly (idempotent) — it's driven by a cron.
   */
  async matchPendingRequests(
    em?: EntityManager,
  ): Promise<{ pooled: number; poolsTouched: number }> {
    const manager = em ?? this.entityManager;
    const today = new Date().toISOString().slice(0, 10);

    const pending = await manager.find(TripRequest, {
      where: {
        status: TripRequestStatus.PENDING,
        poolId: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });

    // Only consider requests whose date is today or later.
    const eligible = pending.filter((r) => r.requestedDate >= today);
    if (!eligible.length) return { pooled: 0, poolsTouched: 0 };

    // Bucket by a normalised route+date key.
    const buckets = new Map<string, TripRequest[]>();
    for (const req of eligible) {
      const key = this.matchKey(req.origin, req.destination, req.requestedDate);
      const list = buckets.get(key) ?? [];
      list.push(req);
      buckets.set(key, list);
    }

    let pooled = 0;
    const touched = new Set<string>();

    for (const [key, members] of buckets) {
      // When we're handed a transaction (e.g. pooling a request the moment
      // it's created), reuse it so the new row is visible and everything
      // commits atomically. On the cron path we own the boundary, so each
      // bucket gets its own short transaction to avoid holding locks across
      // the whole sweep.
      const pool = em
        ? await this.upsertPool(key, members, em)
        : await this.entityManager.transaction((t) =>
            this.upsertPool(key, members, t),
          );
      if (!pool) continue; // e.g. departure already passed
      touched.add(pool.id);
      pooled += members.length;
    }

    if (pooled) {
      this.logger.log(`Matched ${pooled} request(s) into ${touched.size} pool(s).`);
    }
    return { pooled, poolsTouched: touched.size };
  }

  /**
   * Pool a single freshly-created request straight away, inside the caller's
   * transaction, so a passenger's request enters the matching pipeline the
   * instant it's made — no admin step, no waiting for the next cron tick.
   * Idempotent and best-effort: an already-pooled request or one whose
   * departure has passed is simply skipped.
   */
  async matchRequestNow(
    requestId: string,
    em: EntityManager,
  ): Promise<TripRequestPool | null> {
    const req = await em.findOne(TripRequest, { where: { id: requestId } });
    if (!req) return null;
    if (req.status !== TripRequestStatus.PENDING) return null;
    if (req.poolId) return null; // already in a pool

    const today = new Date().toISOString().slice(0, 10);
    if (req.requestedDate < today) return null;

    return this.upsertPool(
      this.matchKey(req.origin, req.destination, req.requestedDate),
      [req],
      em,
    );
  }

  /** Create or extend the MATCHING pool for a route+date and attach members. */
  private async upsertPool(
    matchKey: string,
    members: TripRequest[],
    em: EntityManager,
  ): Promise<TripRequestPool | null> {
    const [sample] = members;
    const requestedDate = sample.requestedDate;

    // Earliest preferred time wins (default 06:00 when nobody stated one).
    // The concrete clock time comes from each member's chosen slot; the raw
    // `preferredTime` field now holds a display range, not a parseable time.
    const earliestTime = members
      .map((m) => this.slotDepartureTime(m))
      .filter(Boolean)
      .sort()[0] ?? DEFAULT_DEPARTURE_TIME;

    const departureAt = new Date(`${requestedDate}T${earliestTime}`);
    if (Number.isNaN(departureAt.getTime())) return null;
    if (departureAt.getTime() <= Date.now()) return null; // already in the past

    const isInter = isInterStateTrip(sample.origin, sample.destination);
    const windowHours = isInter ? INTER_STATE_WINDOW_HOURS : INTRA_STATE_WINDOW_HOURS;
    const now = new Date();

    // Runs inside the caller's transaction (cron sweep or on-create match).
    // Reuse an existing OPEN pool for this route+date — one that's still
    // MATCHING or already on the BOARD — so late arrivals join the same group.
    // CLAIMED/EXPIRED/FULFILLED pools are excluded, so a new request there
    // starts a fresh pool.
    let pool = await em.findOne(TripRequestPool, {
      where: {
        matchKey,
        status: In([TripPoolStatus.MATCHING, TripPoolStatus.BOARD]),
      },
    });

    const isNew = !pool;

    if (!pool) {
      pool = em.create(TripRequestPool, {
        matchKey,
        origin: sample.origin,
        destination: sample.destination,
        originState: resolveNigeriaState(sample.origin),
        destinationState: resolveNigeriaState(sample.destination),
        isInterState: isInter,
        requestedDate,
        departureTime: earliestTime,
        departureAt,
        dispatchWindowHours: windowHours,
        // Straight onto the driver board — no dispatch window. dispatchAt /
        // dispatchedAt are stamped "now" so the board query and any downstream
        // reporting stay consistent.
        dispatchAt: now,
        dispatchedAt: now,
        status: TripPoolStatus.BOARD,
        totalSeats: 0,
        memberCount: 0,
      });
      pool = await em.save(TripRequestPool, pool);
    } else {
      // Keep the earliest preferred time if a new member wants to leave sooner.
      if (earliestTime < (pool.departureTime ?? DEFAULT_DEPARTURE_TIME)) {
        pool.departureTime = earliestTime;
        pool.departureAt = departureAt;
      }
    }

    // Attach members and recompute totals from the DB (authoritative).
    const ids = members.map((m) => m.id);
    await em.update(TripRequest, { id: In(ids) }, { poolId: pool.id });

    const all = await em.find(TripRequest, { where: { poolId: pool.id } });
    pool.memberCount = all.length;
    pool.totalSeats = all.reduce((sum, r) => sum + (r.seats ?? 1), 0);
    const saved = await em.save(TripRequestPool, pool);

    // Tell active drivers the instant a brand-new pool lands on the board.
    // Best-effort (notifyDriversOfBoard swallows its own errors), and only for
    // a newly created pool so late joiners don't re-spam drivers.
    if (isNew) {
      await this.notifyDriversOfBoard(saved);
    }

    return saved;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. DISPATCH — push due pools to the driver board (12h/18h before departure)
  // ════════════════════════════════════════════════════════════════════════

  async dispatchDuePools(): Promise<{ dispatched: number }> {
    const now = new Date();

    const due = await this.poolRepo.find({
      where: {
        status: TripPoolStatus.MATCHING,
        dispatchAt: LessThanOrEqual(now),
        departureAt: MoreThan(now),
      },
      order: { departureAt: 'ASC' },
    });

    if (!due.length) return { dispatched: 0 };

    for (const pool of due) {
      pool.status = TripPoolStatus.BOARD;
      pool.dispatchedAt = now;
      await this.poolRepo.save(pool);
      await this.notifyDriversOfBoard(pool);
    }

    this.logger.log(`Dispatched ${due.length} pool(s) to the driver board.`);
    return { dispatched: due.length };
  }

  /** Expire pools whose departure has passed with no driver. */
  async expireStalePools(): Promise<{ expired: number }> {
    const now = new Date();
    const stale = await this.poolRepo.find({
      where: {
        status: In([TripPoolStatus.MATCHING, TripPoolStatus.BOARD]),
        departureAt: LessThanOrEqual(now),
      },
    });
    if (!stale.length) return { expired: 0 };

    for (const pool of stale) {
      pool.status = TripPoolStatus.EXPIRED;
      await this.poolRepo.save(pool);
    }
    return { expired: stale.length };
  }

  /** Notify active drivers that a new pooled request is on the board. */
  private async notifyDriversOfBoard(pool: TripRequestPool): Promise<void> {
    try {
      const drivers = await this.driverRepo.find({
        where: { licenseVerified: true },
        select: ['userId'],
      });
      const userIds = drivers.map((d) => d.userId).filter(Boolean);
      if (!userIds.length) return;

      await this.notificationService.notifyMany(userIds, {
        title: 'New trip request on the board',
        body:
          `${pool.totalSeats} passenger(s) want ${pool.origin} → ${pool.destination} ` +
          `on ${pool.requestedDate}. Tap to claim.`,
        type: NotificationType.TRIP_REQUEST_BOARD,
        data: {
          poolId: pool.id,
          origin: pool.origin,
          destination: pool.destination,
          requestedDate: pool.requestedDate,
          departureTime: pool.departureTime,
          totalSeats: pool.totalSeats,
          isInterState: pool.isInterState,
        },
      });
         // Direct Expo push, per driver
    for (const userId of userIds) {
      await this.pushToUser(userId, 'New trip request on the board', `${pool.totalSeats} passenger(s) want ${pool.origin} → ${pool.destination} ` +
          `on ${pool.requestedDate}. Tap to claim.`);
    }
    } catch (err) {
      this.logger.warn(`Failed to notify drivers for pool ${pool.id}: ${err?.message}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. DRIVER BOARD — list + claim
  // ════════════════════════════════════════════════════════════════════════

  async getDriverBoard(query: BoardQueryDto): Promise<PagedDto<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.poolRepo
      .createQueryBuilder('pool')
      .where('pool.status = :status', { status: TripPoolStatus.BOARD })
      .andWhere('pool.departureAt > NOW()');

    if (query.scope === 'intra') qb.andWhere('pool.isInterState = false');
    if (query.scope === 'inter') qb.andWhere('pool.isInterState = true');

    // Combined: origin OR destination in the given state.
    if (query.state) {
      qb.andWhere(
        '(pool.originState ILIKE :st OR pool.destinationState ILIKE :st)',
        { st: `%${query.state}%` },
      );
    }

    // Direction-specific: leaving a state, and/or heading to a state.
    if (query.originState) {
      qb.andWhere('pool.originState ILIKE :os', { os: `%${query.originState}%` });
    }
    if (query.destinationState) {
      qb.andWhere('pool.destinationState ILIKE :ds', {
        ds: `%${query.destinationState}%`,
      });
    }

    qb.orderBy('pool.departureAt', 'ASC').addOrderBy('pool.id', 'ASC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Pull the passenger notes for the pools on this page in one query, then
    // group them by pool (a pool can hold several passengers, so notes is a list).
    const poolIds = data.map((p) => p.id);
    const members = poolIds.length
      ? await this.requestRepo.find({
          where: { poolId: In(poolIds) },
          select: ['id', 'poolId', 'note'],
        })
      : [];

    const notesByPool = new Map<string, string[]>();
    for (const m of members) {
      if (!m.poolId || !m.note) continue;
      const list = notesByPool.get(m.poolId) ?? [];
      list.push(m.note);
      notesByPool.set(m.poolId, list);
    }

    // Surface the human departure window (e.g. "5:00 PM - 7:00 PM") alongside
    // the pool's concrete departureTime, plus the passenger note, so drivers
    // see the same label passengers picked and any context they added. When a
    // pool has several passengers their notes are joined into one string.
    const enriched = data.map((pool) => {
      const poolNotes = notesByPool.get(pool.id);
      return {
        ...pool,
        preferredTime: this.rangeForTime(pool.departureTime),
        note: poolNotes?.length ? poolNotes.join(' | ') : null,
      };
    });

    return this.toPaged(enriched, total, page, limit, skip);
  }

  /** Map a concrete HH:mm:ss departure time back to its display window. */
  private rangeForTime(time?: string | null): string | null {
    const hhmm = this.normalizeTime(time);
    if (!hhmm) return null;
    const slot = (Object.keys(PREFERRED_TIME_SLOT_TO_TIME) as PreferredTime[]).find(
      (s) => PREFERRED_TIME_SLOT_TO_TIME[s] === hhmm,
    );
    return slot ? PREFERRED_TIME_SLOT_TO_RANGE[slot] : null;
  }

  /** A driver claims a pooled request; optionally attaches a trip they own. */
  async claimPool(
    driverUserId: string,
    poolId: string,
    dto: ClaimPoolDto,
  ): Promise<TripRequestPool> {
    return this.entityManager.transaction(async (em) => {
      const driver = await em.findOne(Driver, { where: { userId: driverUserId } });
      if (!driver) throw new NotFoundException('Driver profile not found');

      const pool = await em.findOne(TripRequestPool, { where: { id: poolId } });
      if (!pool) throw new NotFoundException('Trip request pool not found');

      if (pool.status !== TripPoolStatus.BOARD) {
        throw new BadRequestException(
          `This request is ${pool.status} and can no longer be claimed.`,
        );
      }

      // Optional trip attachment — must belong to the claiming driver.
      let linkedTripId: string | null = null;
      if (dto.tripId) {
        const trip = await em.findOne(Trip, { where: { id: dto.tripId } });
        if (!trip) throw new NotFoundException('Linked trip not found');
        if (trip.driverId !== driver.id) {
          throw new ForbiddenException('That trip does not belong to you');
        }
        linkedTripId = trip.id;
      }

      pool.status = TripPoolStatus.CLAIMED;
      pool.claimedByDriverId = driver.id;
      pool.claimedAt = new Date();
      pool.linkedTripId = linkedTripId;
      pool.metadata = { ...(pool.metadata ?? {}), claimNote: dto.note ?? null };
      await em.save(TripRequestPool, pool);

      // Move member requests to APPROVED and notify each passenger.
      const members = await em.find(TripRequest, { where: { poolId: pool.id } });
      for (const req of members) {
        req.status = TripRequestStatus.APPROVED;
        req.linkedTripId = linkedTripId;
        req.processedAt = new Date();
        await em.save(TripRequest, req);
        await this.notifyPassengerClaimed(req, pool, linkedTripId);
      }

      return pool;
    });
  }

  private async notifyPassengerClaimed(
    req: TripRequest,
    pool: TripRequestPool,
    linkedTripId: string | null,
  ): Promise<void> {
    try {
      await this.notificationService.notify({
        userId: req.requesterUserId,
        title: 'A driver is arranging your trip',
        body:
          `Good news — a driver picked up your request for ${pool.origin} → ` +
          `${pool.destination} on ${pool.requestedDate}.` +
          (linkedTripId ? ' Tap to book your seat.' : ''),
        type: NotificationType.TRIP_REQUEST_CLAIMED,
        data: {
          tripRequestId: req.id,
          poolId: pool.id,
          tripId: linkedTripId,
          origin: pool.origin,
          destination: pool.destination,
          requestedDate: pool.requestedDate,
        },
      });
      await this.pushToUser(req.requesterUserId, 'Trip Request Claimed', `Your trip request for ${pool.origin} → ${pool.destination} has been claimed by a driver.`);
    } catch (err) {
      this.logger.warn(`Failed to notify passenger ${req.requesterUserId}: ${err?.message}`);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  /** Fetch the user's Expo token and push directly. Best-effort. */
private async pushToUser(userId: string, title: string, body: string, data?: any) {
  try {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.expoToken) {
      this.logger.warn(`No expoToken for user ${userId}; skipping push`);
      return;
    }
    await this.expoService.sendPushNotification(user.expoToken, title, body, data);
  } catch (err) {
    this.logger.warn(`Expo push failed for ${userId}: ${err?.message}`);
  }
}

 /**
 * Called when a driver creates a trip. Finds every PENDING request on the
 * same route + date, approves it, links it to the new trip, closes its pool,
 * and notifies the passenger — no admin. Best-effort, runs in the caller's
 * transaction/manager, and only touches PENDING requests so nobody is
 * approved or notified twice.
 */
async fulfillRequestsForTrip(
  args: { tripId: string; origin: string; destination: string; date: string },
  em: EntityManager,
): Promise<number> {
  const { tripId, origin, destination, date } = args;
  if (!origin || !destination || !date) return 0;

  // Both sides must be ISO before comparison. Requests are normalised on
  // create; trips are not, so coerce here.
  const iso = (d: string) => {
    const t = String(d ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : t;
  };

  const tripDate = iso(date);
  const key = this.matchKey(origin, destination, tripDate);
  this.logger.debug(`fulfillRequestsForTrip: trip ${tripId} key=${key}`);

  // All requests still waiting. We compare keys in memory so date-format
  // differences never hide a match at the SQL layer.
  const pending = await em.find(TripRequest, {
    where: { status: TripRequestStatus.PENDING },
  });

  const matches = pending.filter(
    (r) =>
      this.matchKey(r.origin, r.destination, iso(r.requestedDate)) === key,
  );

  if (!matches.length) {
    this.logger.debug(
      `fulfillRequestsForTrip: no PENDING request matched key=${key} ` +
        `(scanned ${pending.length})`,
    );
    return 0;
  }

  for (const req of matches) {
    req.status = TripRequestStatus.APPROVED;
    req.linkedTripId = tripId;
    req.processedAt = new Date();
    await em.save(TripRequest, req);

    // Close the pool this request was sitting in, if any.
    if (req.poolId) {
      await em.update(
        TripRequestPool,
        { id: req.poolId },
        {
          status: TripPoolStatus.CLAIMED,
          linkedTripId: tripId,
          claimedAt: new Date(),
        },
      );
    }

    // Notify the passenger (per-passenger best-effort — one failure must
    // not stop the others).
    try {
      await this.notificationService.notify({
        userId: req.requesterUserId,
        title: 'Your trip request was approved',
        body:
          `A driver created a trip for ${req.origin} → ${req.destination} ` +
          `on ${req.requestedDate}. Tap to book your seat.`,
        type: NotificationType.TRIP_REQUEST_APPROVED,
        data: {
          tripRequestId: req.id,
          tripId,
          origin: req.origin,
          destination: req.destination,
          requestedDate: req.requestedDate,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify passenger ${req.requesterUserId}: ${err?.message}`,
      );
    }
        await this.pushToUser(req.requesterUserId, 'Your trip request was approved', `Your trip request for ${req.origin} → ${req.destination} has been approved.`);
  }

  this.logger.log(
    `Trip ${tripId} auto-approved ${matches.length} request(s).`,
  );
  return matches.length;
}

  /** `origin|destination|date`, each side normalised to a stable token. */
  private matchKey(origin: string, destination: string, date: string): string {
    return `${this.locationToken(origin)}|${this.locationToken(destination)}|${date}`;
  }

  /** Normalise a free-text location to a coarse city token for grouping. */
  private locationToken(value: string): string {
    return String(value ?? '')
      .split('(')[0]        // drop "(CMS)" style suffixes
      .split(',')[0]        // keep the first comma-segment
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  private normalizeTime(t?: string | null): string | null {
    if (!t) return null;
    const m = String(t).trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!m) return null;
    return `${m[1]}:${m[2]}:${m[3] ?? '00'}`;
  }

  /**
   * Concrete HH:mm:ss departure time for pool scheduling. Preferred source is
   * the chosen slot in metadata; falls back to a raw clock value in
   * `preferredTime` for rows created before it became a display range.
   */
  private slotDepartureTime(req: TripRequest): string | null {
    const slot = req.metadata?.preferredSlot as PreferredTime | undefined;
    if (slot && PREFERRED_TIME_SLOT_TO_TIME[slot]) {
      return PREFERRED_TIME_SLOT_TO_TIME[slot];
    }
    return this.normalizeTime(req.preferredTime);
  }

  private toPaged(
    data: any[],
    total: number,
    page: number,
    limit: number,
    skip: number,
  ): PagedDto<any> {
    const paged = new PagedDto();
    paged.data = data;
    paged.meta = {
      page,
      limit,
      count: data.length,
      previousPage: page > 1 ? page - 1 : false,
      nextPage: skip + limit < total ? page + 1 : false,
      pageCount: Math.ceil(total / limit),
      totalRecords: total,
    };
    return paged;
  }
}