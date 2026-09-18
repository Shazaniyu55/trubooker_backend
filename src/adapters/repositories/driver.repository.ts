import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Driver } from '@modules/core/entities/driver.entity';
import { UpdateDriverProfileDto } from '@modules/driver/dtos/updatedriver.dto';
import { User } from '@modules/core/entities/user.entity';
import { VehicleType } from '@modules/core/entities/vehicletype.entity';
import { EscrowStatus, PayoutStatus, TripStatus } from 'src/types/enums';
import { Trip } from '@modules/core/entities/trip.entity';
import { Escrow } from '@modules/core/entities/escro.entity';
import { Payout } from '@modules/core/entities/payout.entity';
import { Booking } from '@modules/core/entities/booking.entity';
import { DeleteUserDto } from '@modules/auth/dtos/deleteuser.dto';

@Injectable()
export class DriverRepository extends Repository<Driver> {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    private readonly entityManager: EntityManager,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(VehicleType) private readonly vehicleTypeRepo: Repository<VehicleType>,
    @InjectRepository(Trip) private readonly tripRepository: Repository<Trip>,
    @InjectRepository(Escrow) private readonly escrowRepo: Repository<Escrow>,
    @InjectRepository(Payout) private readonly payoutRepo: Repository<Payout>
    
  ) {
    super(driverRepository.target, driverRepository.manager, driverRepository.queryRunner);
  }

  async createDriver(data: Partial<Driver>, entityManager?: EntityManager): Promise<Driver> {
    const manager = entityManager || this.entityManager;
    const driver = manager.create(Driver, data);
    return manager.save(Driver, driver);
  }

  async findByUserId(id: string): Promise<Driver> {
    return this.findOne({ where: { id }, relations: ['users'] });
  }

  async updateDriver(
  id: string,
  dto: UpdateDriverProfileDto,
  entityManager?: EntityManager,
): Promise<Driver> {
  const manager = entityManager || this.entityManager;

  const driver = await this.driverRepository.findOne({
    where: { userId: id },
    relations: ['user'],
  });

  if (!driver) {
    throw new NotFoundException('Driver profile not found');
  }

  const userUpdates: Partial<User> = {};

  if (dto.firstName) userUpdates.firstName = dto.firstName;
  if (dto.lastName) userUpdates.lastName = dto.lastName;
  if (dto.phone) userUpdates.phone = dto.phone;
  if (dto.profileImage) userUpdates.profileImage = dto.profileImage;
  if (dto.about) userUpdates.about = dto.about;
  if (dto.yearOfExp) userUpdates.yearOfExp = dto.yearOfExp;
  if (dto.state) userUpdates.state = dto.state;
  if (dto.dob) userUpdates.dob = dto.dob;
  if (dto.city) userUpdates.city = dto.city;
  if (dto.address) userUpdates.address = dto.address;
  if (dto.gender) userUpdates.gender = dto.gender;
  if (dto.country) userUpdates.country = dto.country;

  // merge state into the user's metadata JSON
  if (dto.state) {
    userUpdates.metadata = {
      ...(driver.user.metadata ?? {}),
      state: dto.state,
    };
  }

  if (Object.keys(userUpdates).length > 0) {
    await manager.update(User, driver.user.id, userUpdates);
  }

  return await this.driverRepository.findOne({
    where: { userId: id },     // was { id } — see note below
    relations: ['user'],
  });
}



/**
 * Delete (soft-delete) a driver's account.
 *
 * Unlike a passenger, a driver disappearing mid-trip strands whoever booked
 * a seat with them — so this refuses to delete while the driver has any
 * trip that's still PENDING/ACTIVE/STARTED, and while they're sitting on
 * an un-withdrawn wallet balance (make them cash out first, or an admin
 * has to intervene).
 */
async deleteUser(
  id: string,
  data: DeleteUserDto,
  entityManager?: EntityManager,
): Promise<User> {
  const manager = entityManager || this.entityManager;
 
  const driver = await manager.findOne(Driver, { where: { userId: id } });
  if (!driver) throw new NotFoundException('Driver profile not found');
 
  const openTrip = await manager.findOne(Trip, {
    where: [
      { driverId: driver.id, status: TripStatus.PENDING },
      { driverId: driver.id, status: TripStatus.ACTIVE },
      { driverId: driver.id, status: TripStatus.STARTED },
    ],
  });
  if (openTrip) {
    throw new BadRequestException(
      'You have an upcoming or in-progress trip. Cancel or complete it before deleting your account.',
    );
  }
 
  if (Number(driver.currentBalance) > 0) {
    throw new BadRequestException(
      'You have an outstanding wallet balance. Withdraw it before deleting your account.',
    );
  }
 
  const user = await manager.findOne(User, { where: { id } });
  if (!user) throw new NotFoundException('User not found');
 
  if (data && Object.keys(data).length > 0) {
    await manager.update(User, id, data);
  }
 
  await manager.softDelete(User, id);
  return manager.findOne(User, { where: { id }, withDeleted: true });
}


    async getProfile(userId: string) {
      const passenger = await this.driverRepository.findOne({
        where: { userId },
        relations: ['user'],
      });
      if (!passenger) throw new NotFoundException('driver profile not found');
      return passenger;
    }

async getVehicleType(): Promise<VehicleType[]> {
  return this.vehicleTypeRepo.find({
    order: { name: 'ASC' },
  });
}

async findByIdOrUserId(id: string): Promise<Driver | null> {
    const byId = await this.driverRepository.findOne({ where: { id } });
    if (byId) return byId;
    return this.driverRepository.findOne({ where: { userId: id } });
  }

  async getVehicleTypeById(id: string): Promise<VehicleType | null> {
    return this.vehicleTypeRepo.findOne({ where: { id } });
  }

async getDriverDashboard(userId: string, query: { page?: number; limit?: number } = {}) {
  const driver = await this.driverRepository.findOne({
    where: { userId },
    relations: ['user'],
  });
  if (!driver) throw new NotFoundException('Driver profile not found');

  const { page = 1, limit = 20 } = query;
  const skip = (page - 1) * limit;

  // ── earnings window: last 7 days, computed in UTC so JS keys and SQL
  //    day-bucketing always agree (the old code mixed local midnight with
  //    toISOString(), which shifted every day back by one on UTC+ servers) ──
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - 6);

  const [
    cancelled,
    completed,
    directCreditRows,
    escrowRows,
    payoutRow,
    earnedEscrowRow,
    earnedDirectRow,
    referralCount,
    [upcoming, upcomingTotal],
    [completedTrips, completedTotal],
    [cancelledTrips, cancelledTotal],
  ] = await Promise.all([
    // ── activity: trip counts by status ──
    this.tripRepository.count({ where: { driverId: driver.id, status: TripStatus.CANCELLED } }),
    this.tripRepository.count({ where: { driverId: driver.id, status: TripStatus.COMPLETED } }),

    // ── earnings source #1: direct payouts recorded on bookings.
    //    completeTrip() -> creditDriverForTrip() bypasses escrow and stamps
    //    booking.metadata with { driverCredited, netDriverAmount, driverCreditedAt } ──
    this.entityManager
      .createQueryBuilder(Booking, 'b')
      .innerJoin(Trip, 't', 't.id = b.tripId')
      .select("TO_CHAR(((b.metadata->>'driverCreditedAt')::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'day')
      .addSelect("COALESCE(SUM((b.metadata->>'netDriverAmount')::numeric), 0)", 'amount')
      .where('t.driverId = :driverId', { driverId: driver.id })
      .andWhere("b.metadata ? 'driverCreditedAt'")
      .andWhere("(b.metadata->>'driverCredited')::boolean IS TRUE")
      .andWhere("(b.metadata->>'driverCreditedAt')::timestamptz >= :since", { since })
      .groupBy('day')
      .getRawMany(),

    // ── earnings source #2: legacy escrow releases that actually paid the
    //    driver (exclude the "escrow bypassed" cleanup rows, which are
    //    already counted via booking metadata above) ──
    this.escrowRepo
      .createQueryBuilder('e')
      .select("TO_CHAR(e.releasedAt AT TIME ZONE 'UTC', 'YYYY-MM-DD')", 'day')
      .addSelect('COALESCE(SUM(e.netDriverAmount), 0)', 'amount')
      .where('e.driverId = :driverId', { driverId: driver.id })
      .andWhere('e.status = :status', { status: EscrowStatus.RELEASED })
      .andWhere("(e.releaseReason IS NULL OR e.releaseReason NOT ILIKE '%bypassed%')")
      .andWhere('e.releasedAt >= :since', { since })
      .groupBy('day')
      .getRawMany(),

    // ── payment: total ever paid out (withdrawn) to this driver ──
    this.payoutRepo
      .createQueryBuilder('p')
      .select('COALESCE(SUM(p.amount), 0)', 'total')
      .where('p.driverId = :driverId', { driverId: driver.id })
      .andWhere('p.status IN (:...statuses)', {
        statuses: [PayoutStatus.APPROVED, PayoutStatus.COMPLETED],
      })
      .getRawOne(),

    // ── earnings (all-time) source #1: escrow released to the driver at
    //    boarding/scan time. Exclude "bypassed" cleanup rows (those are
    //    counted via booking metadata below). This is what the driver has
    //    actually MADE, regardless of whether it has been withdrawn yet. ──
    this.escrowRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.netDriverAmount), 0)', 'total')
      .where('e.driverId = :driverId', { driverId: driver.id })
      .andWhere('e.status = :status', { status: EscrowStatus.RELEASED })
      .andWhere("(e.releaseReason IS NULL OR e.releaseReason NOT ILIKE '%bypassed%')")
      .getRawOne(),

    // ── earnings (all-time) source #2: legacy direct credits stamped on
    //    booking metadata by older completion flows. ──
    this.entityManager
      .createQueryBuilder(Booking, 'b')
      .innerJoin(Trip, 't', 't.id = b.tripId')
      .select("COALESCE(SUM((b.metadata->>'netDriverAmount')::numeric), 0)", 'total')
      .where('t.driverId = :driverId', { driverId: driver.id })
      .andWhere("b.metadata ? 'driverCredited'")
      .andWhere("(b.metadata->>'driverCredited')::boolean IS TRUE")
      .getRawOne(),

    // ── referral ──
    this.userRepo.count({ where: { referredBy: driver.userId } }),

    // ── upcoming trips: paginated ──
    this.tripRepository.findAndCount({
      where: [
        { driverId: driver.id, status: TripStatus.PENDING },
        { driverId: driver.id, status: TripStatus.ACTIVE },
      ],
      order: { departureDate: 'ASC' },
      skip,
      take: limit,
    }),

    // ── completed trips: paginated, most recent first ──
    this.tripRepository.findAndCount({
      where: { driverId: driver.id, status: TripStatus.COMPLETED },
      order: { departureDate: 'DESC' },
      skip,
      take: limit,
    }),

    // ── cancelled trips: paginated, most recent first ──
    this.tripRepository.findAndCount({
      where: { driverId: driver.id, status: TripStatus.CANCELLED },
      order: { departureDate: 'DESC' },
      skip,
      take: limit,
    }),
  ]);

  // Total the driver has actually MADE (all-time), from escrow releases at
  // scan time plus any legacy direct credits. This is independent of payouts,
  // so it stays correct whether or not the driver has withdrawn.
  const totalEarned =
    Number(earnedEscrowRow?.total ?? 0) + Number(earnedDirectRow?.total ?? 0);

  // Merge both earnings sources into one day → amount map
  const earningMap = new Map<string, number>();
  for (const r of [...directCreditRows, ...escrowRows]) {
    earningMap.set(r.day, (earningMap.get(r.day) ?? 0) + Number(r.amount ?? 0));
  }

  const earnings = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    return { amount: earningMap.get(key) ?? 0, day: key };
  });

  // Shared shape for every trip list on the dashboard
  const mapTrip = (t: Trip) => ({
    id: t.id,
    status: t.status,
    departure_date: t.departureDate,
    departure_time: t.departureTime,
    departure_location: t.departureLocation,
    arrival_date: t.arrivalDate ?? '',
    arrival_time: t.arrivalTime ?? '',
    arrival_destination: this.normalizeDestination(t.arrivalDestination),
  });

  const buildMeta = (count: number, totalRecords: number) => ({
    page,
    limit,
    count,
    previousPage: page > 1 ? page - 1 : false,
    nextPage: skip + limit < totalRecords ? page + 1 : false,
    pageCount: Math.ceil(totalRecords / limit),
    totalRecords,
  });

  return {
    id: driver.id,
    title: `${driver.user?.firstName ?? ''} ${driver.user?.lastName ?? ''}`.trim() || 'Driver',
    attribute: {
      activity: {
        total_trips_cancelled: String(cancelled),
        total_trips_completed: String(completed),
      },
      earnings,
      payment: {
        // Total the driver has earned all-time (credited at ticket scan).
        total_amount: String(totalEarned),
        // Current withdrawable wallet balance.
        wallet_balance: String(driver.currentBalance ?? 0),
        // Total already withdrawn/paid out to the driver's bank.
        total_paid_out: String(payoutRow?.total ?? '0'),
      },
      referral: { referral: String(referralCount) },
      upcoming_trips: {
        data: upcoming.map(mapTrip),
        meta: buildMeta(upcoming.length, upcomingTotal),
      },
      completed_trips: {
        data: completedTrips.map(mapTrip),
        meta: buildMeta(completedTrips.length, completedTotal),
      },
      cancelled_trips: {
        data: cancelledTrips.map(mapTrip),
        meta: buildMeta(cancelledTrips.length, cancelledTotal),
      },
    },
  };
}


async getDriverTripStatus(userId: string, type?: string) {
  const driver = await this.driverRepository.findOne({ where: { userId } });
  if (!driver) throw new NotFoundException('Driver profile not found');

  const where: any = { driverId: driver.id };

  if (type) {
    // validate against the enum so a bad value fails loudly
    const valid = Object.values(TripStatus) as string[];
    if (!valid.includes(type)) {
      throw new BadRequestException(
        `Invalid trip_type "${type}". Allowed: ${valid.join(', ')}`,
      );
    }
    where.status = type;
  }

  const trips = await this.tripRepository.find({
    where,
    order: { createdAt: 'DESC' },
  });

  return trips.map((t) => ({
    id: t.id,
    reference: t.reference,
    departure_location: t.departureLocation,
    arrival_destination: this.normalizeDestination(t.arrivalDestination),
    departure_date: t.departureDate,
    departure_time: t.departureTime,
    price: t.price,
    status: t.status,
  }));
}

private normalizeDestination(dest: any): {
  address: string; latitude: string; longitude: string; name: string;
} {
  // arrivalDestination is jsonb (any[] in your entity) — coerce to the flat shape.
  const d = Array.isArray(dest) ? (dest[0] ?? {}) : (dest ?? {});
  return {
    address: d.address ?? '',
    latitude: String(d.latitude ?? ''),
    longitude: String(d.longitude ?? ''),
    name: d.name ?? '',
  };
}


}


