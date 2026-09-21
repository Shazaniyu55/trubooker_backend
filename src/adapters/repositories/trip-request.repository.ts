import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, EntityManager, Repository } from 'typeorm';

import { TripRequest } from '@modules/core/entities/trip-request.entity';
import { TripRequestPool } from '@modules/core/entities/trip-request-pool.entity';
import { Passenger } from '@modules/core/entities/passenger.entity';
import { Trip } from '@modules/core/entities/trip.entity';

import { NotificationService } from '@modules/notification/services/notification.service';
import { PagedDto } from '@shared/interface/paged.interface';
import { NotificationType, TripRequestStatus, TripPoolStatus, PREFERRED_TIME_RANGE_TO_SLOT,
 } from '../../types/enums';

import {
  ApproveTripRequestDto,
  CreateTripRequestDto,
  DeclineTripRequestDto,
  TripRequestListQueryDto,
} from '@modules/trip-request/dtos/trip-request.dto';
import { ResolvedPlace } from '@shared/utils/geo/place.util';
@Injectable()
export class TripRequestRepository extends Repository<TripRequest> {
  private readonly logger = new Logger(TripRequestRepository.name);

  constructor(
    private readonly entityManager: EntityManager,
    private readonly notificationService: NotificationService,
    @InjectRepository(TripRequest)
    private readonly tripRequestRepo: Repository<TripRequest>,
    @InjectRepository(Passenger)
    private readonly passengerRepo: Repository<Passenger>,
  ) {
    super(
      tripRequestRepo.target,
      tripRequestRepo.manager,
      tripRequestRepo.queryRunner,
    );
  }

  /** Accepts DD-MM-YYYY, DD/MM/YYYY or YYYY-MM-DD; returns YYYY-MM-DD. */
  private normalizeDate(input: string): string | null {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const m = trimmed.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      const month = Number(mm);
      const day = Number(dd);
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  /** Normalise the optional status filter to a non-empty array, or undefined. */
  private statusFilter(
    status?: TripRequestStatus | TripRequestStatus[],
  ): TripRequestStatus[] | undefined {
    if (status == null) return undefined;
    const arr = Array.isArray(status) ? status : [status];
    return arr.length ? arr : undefined;
  }

  /**
   * Pooling is automatic, not an admin job. Once a request has been grouped
   * into a pool the matching pipeline owns it (board → driver claim), so admin
   * approve/decline must not touch it and quietly corrupt the pool's counts.
   * The only exception is an EXPIRED pool — departure passed with no driver —
   * where an admin stepping in as a fallback is legitimate.
   */
  private async assertNotAutoPooled(
    manager: EntityManager,
    req: TripRequest,
    action: 'approved' | 'declined',
  ): Promise<void> {
    if (!req.poolId) return;
    const pool = await manager.findOne(TripRequestPool, {
      where: { id: req.poolId },
    });
    if (pool && pool.status !== TripPoolStatus.EXPIRED) {
      throw new BadRequestException(
        `This request is already being matched automatically (pool ${pool.status}) ` +
          `and can't be ${action} by an admin. It will be offered to drivers on the board.`,
      );
    }
  }

  // ─── Passenger: create a request → notify admins ─────────────────────────
  async createRequest(
    requesterUserId: string,
    dto: CreateTripRequestDto,
    entityManager?: EntityManager,
    originPlace?: ResolvedPlace | null,
  ): Promise<TripRequest> {
    const manager = entityManager ?? this.entityManager;

    const iso = this.normalizeDate(dto.date);
    if (!iso) {
      throw new BadRequestException(
        'Invalid date format. Use DD-MM-YYYY or YYYY-MM-DD.',
      );
    }

    const passenger = await manager.findOne(Passenger, {
      where: { userId: requesterUserId },
    });

    // Guard against duplicate open requests for the same route+date.
    const existing = await manager.findOne(TripRequest, {
      where: {
        requesterUserId,
        origin: dto.origin,
        
        destination: dto.destination,
        requestedDate: iso,
        status: TripRequestStatus.PENDING,
      },
    });
    if (existing) return existing;

       // The client sends the display range directly (e.g. "7:00 AM - 9:00 AM").
    // Store it as-is; derive the slot so the matcher can compute a concrete
    // departure time and grouping stays consistent.
    const preferredTime = dto.preferredTime ?? null;
    const preferredSlot = preferredTime
      ? PREFERRED_TIME_RANGE_TO_SLOT[preferredTime] ?? null
      : null;

    const entity = manager.create(TripRequest, {
      requesterUserId,
      passengerId: passenger?.id ?? null,
      origin: dto.origin,
        originState: originPlace?.state ?? null,
      originLga: originPlace?.lga ?? null,
      originCity: originPlace?.city ?? null,
      destination: dto.destination,
      requestedDate: iso,
      seats: dto.seats ?? 1,
      preferredTime,
      note: dto.note ?? null,
      status: TripRequestStatus.PENDING,
      metadata: preferredSlot ? { preferredSlot } : null,
    });

    const saved = await manager.save(TripRequest, entity);

    // Best-effort confirmation to the PASSENGER who made the request — this
    // is what triggers their Expo push. Separate try/catch from the admin
    // fan-out below so a failure notifying admins can never suppress the
    // passenger's own confirmation, or vice versa.
    try {
      await this.notificationService.notify({
        userId: saved.requesterUserId,
        title: 'Trip request received',
        body: `We've got your request for ${saved.origin} → ${saved.destination} on ${saved.requestedDate}. We'll notify you once it's matched.`,
        type: NotificationType.TRIP_REQUEST_CREATED,
        data: {
          tripRequestId: saved.id,
          origin: saved.origin,
          destination: saved.destination,
          requestedDate: saved.requestedDate,
          seats: saved.seats,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify passenger ${saved.requesterUserId} of their own request ${saved.id}: ${err?.message}`,
      );
    }

    // Best-effort fan-out to every active admin (dashboard + push).
    try {
      await this.notificationService.notifyAdmins({
        title: 'New trip request',
        body: `A passenger wants ${saved.origin} → ${saved.destination} on ${saved.requestedDate}.`,
        type: NotificationType.TRIP_REQUEST_CREATED,
        data: {
          tripRequestId: saved.id,
          origin: saved.origin,
          destination: saved.destination,
          requestedDate: saved.requestedDate,
          seats: saved.seats,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify admins of trip request ${saved.id}: ${err?.message}`);
    }

    return saved;
  }

  // ─── Passenger: list my requests ─────────────────────────────────────────
  async getMyRequests(
    requesterUserId: string,
    query: TripRequestListQueryDto,
  ): Promise<PagedDto<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.tripRequestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.linkedTrip', 'linkedTrip')
      .where('req.requesterUserId = :requesterUserId', { requesterUserId });

    const statuses = this.statusFilter(query.status);
    if (statuses) {
      qb.andWhere('req.status IN (:...statuses)', { statuses });
    }

    qb.orderBy('req.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.toPaged(data, total, page, limit, skip);
  }

  // ─── Admin: list all requests (trip dashboard) ───────────────────────────
  async listRequests(
    query: TripRequestListQueryDto,
  ): Promise<PagedDto<any>> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const qb = this.tripRequestRepo
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.requester', 'requester')
      .leftJoinAndSelect('req.passenger', 'passenger')
      .leftJoinAndSelect('req.linkedTrip', 'linkedTrip')
      .addSelect(
        `CASE
           WHEN req.status = :pendingStatus   THEN 0
           WHEN req.status = :approvedStatus  THEN 1
           WHEN req.status = :fulfilledStatus THEN 2
           ELSE 3
         END`,
        'status_order',
      )
      .setParameter('pendingStatus', TripRequestStatus.PENDING)
      .setParameter('approvedStatus', TripRequestStatus.APPROVED)
      .setParameter('fulfilledStatus', TripRequestStatus.FULFILLED);

    const statuses = this.statusFilter(query.status);
    if (statuses) {
      qb.andWhere('req.status IN (:...statuses)', { statuses });
    }

    if (query.search) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('req.origin ILIKE :s', { s: `%${query.search}%` })
            .orWhere('req.destination ILIKE :s', { s: `%${query.search}%` })
            .orWhere('req.note ILIKE :s', { s: `%${query.search}%` });
        }),
      );
    }

    // Pending first, then approved, then fulfilled, then declined —
    // newest within each group.
    qb.orderBy('status_order', 'ASC').addOrderBy('req.createdAt', 'DESC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return this.toPaged(data, total, page, limit, skip);
  }

  // ─── Admin: single request ───────────────────────────────────────────────
  async getRequestById(id: string): Promise<TripRequest> {
    const req = await this.tripRequestRepo.findOne({
      where: { id },
      relations: ['requester', 'passenger', 'linkedTrip', 'processedByAdmin'],
    });
    if (!req) throw new NotFoundException('Trip request not found');
    return req;
  }

  // ─── Admin: approve → notify passenger ───────────────────────────────────
  async approveRequest(
    adminId: string,
    id: string,
    dto: ApproveTripRequestDto,
    entityManager?: EntityManager,
  ): Promise<TripRequest> {
    const manager = entityManager ?? this.entityManager;

    const req = await manager.findOne(TripRequest, { where: { id } });
    if (!req) throw new NotFoundException('Trip request not found');
    if (req.status !== TripRequestStatus.PENDING) {
      throw new BadRequestException(
        `Request already ${req.status}. Only pending requests can be approved.`,
      );
    }
    await this.assertNotAutoPooled(manager, req, 'approved');

    let linkedTripId: string | null = null;
    if (dto.tripId) {
      const trip = await manager.findOne(Trip, { where: { id: dto.tripId } });
      if (!trip) throw new NotFoundException('Linked trip not found');
      linkedTripId = trip.id;
    }

    // An approved request is APPROVED regardless of whether a trip is attached.
    // Whether it's been fulfilled by a real trip is recorded on linkedTripId,
    // NOT by overloading the status — otherwise trip-linked approvals never
    // appear in an ?status=approved dashboard view.
    req.status = TripRequestStatus.APPROVED;
    req.linkedTripId = linkedTripId;
    req.adminNote = dto.adminNote ?? null;
    req.processedByAdminId = adminId;
    req.processedAt = new Date();

    const saved = await manager.save(TripRequest, req);

    try {
      await this.notificationService.notify({
        userId: saved.requesterUserId,
        title: 'Your trip request was approved',
        body: linkedTripId
          ? `A trip for ${saved.origin} → ${saved.destination} is now available. Tap to book.`
          : `Your requested trip is now available for booking ${saved.origin} → ${saved.destination}. ${saved.adminNote ?? ''}`.trim(),
        type: NotificationType.TRIP_REQUEST_APPROVED,
        data: {
          tripRequestId: saved.id,
          tripId: linkedTripId,
          origin: saved.origin,
          destination: saved.destination,
          requestedDate: saved.requestedDate,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify passenger of approval for ${saved.id}: ${err?.message}`);
    }

    return saved;
  }

  // ─── Admin: decline → notify passenger ───────────────────────────────────
  async declineRequest(
    adminId: string,
    id: string,
    dto: DeclineTripRequestDto,
    entityManager?: EntityManager,
  ): Promise<TripRequest> {
    const manager = entityManager ?? this.entityManager;

    const req = await manager.findOne(TripRequest, { where: { id } });
    if (!req) throw new NotFoundException('Trip request not found');
    if (req.status !== TripRequestStatus.PENDING) {
      throw new BadRequestException(
        `Request already ${req.status}. Only pending requests can be declined.`,
      );
    }
    await this.assertNotAutoPooled(manager, req, 'declined');

    req.status = TripRequestStatus.DECLINED;
    req.adminNote = dto.reason;
    req.processedByAdminId = adminId;
    req.processedAt = new Date();

    const saved = await manager.save(TripRequest, req);

    try {
      await this.notificationService.notify({
        userId: saved.requesterUserId,
        title: 'Update on your trip request',
        body: `We couldn't arrange ${saved.origin} → ${saved.destination} for now: ${saved.adminNote}`,
        type: NotificationType.TRIP_REQUEST_DECLINED,
        data: {
          tripRequestId: saved.id,
          origin: saved.origin,
          destination: saved.destination,
          requestedDate: saved.requestedDate,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify passenger of decline for ${saved.id}: ${err?.message}`);
    }

    return saved;
  }

  // ─── Shared paging shape (mirrors TripRepository) ────────────────────────
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





