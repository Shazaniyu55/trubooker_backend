import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { Trip } from '@modules/core/entities/trip.entity';
import { CreateDriverTripDto, UpdateDriverTripDto, CancelDriverTripDto, CompleteDriverTripDto } from '../dtos/create-driver.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Driver } from '@modules/core/entities/driver.entity';
import { RandomnessUtil } from '@shared/utils/encryption/randomness.util';
import { BookingStatus, EscrowStatus, NotificationType, PaymentStatus, TripStatus } from 'src/types/enums';
import { Booking } from '@modules/core/entities/booking.entity';
import { Escrow } from '@modules/core/entities/escro.entity';
import { Vehicle } from '@modules/core/entities/vehicle.entity';
import { NotificationService } from '@modules/notification/services/notification.service';
import { DriverRepository } from '@adapters/repositories/driver.repository';
import { UpdateDriverProfileDto } from '../dtos/updatedriver.dto';
import { VehicleType } from '@modules/core/entities/vehicletype.entity';
import { RedisCacheService } from '@modules/cache/redis-cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@modules/cache/redis-cache.constants';
import { ExpoService } from '@modules/notification/services/expo.service';
import { TripMatchingService } from '@modules/trip-matching/service/trip-matching.service';
 
const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE ?? '7'); // 5%
 
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DRIVER TRIP SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * High-level service orchestrating use cases for driver trip management.
 * Acts as a facade to the underlying use cases and business logic.
 */
 
@Injectable()
export class DriverTripService {
  private readonly logger = new Logger(DriverTripService.name);
 
  constructor(
 
    private readonly randomnessUtil: RandomnessUtil,
    
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(Driver) private readonly driverRepo: Repository<Driver>,
    @InjectRepository(Booking) private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Escrow) private readonly escrowRepo: Repository<Escrow>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(VehicleType) private readonly vehicleTypeRepo: Repository<VehicleType>,
    
    private readonly notifiyService:NotificationService,
    private readonly driverRepository: DriverRepository,
    private readonly cache: RedisCacheService,
    private readonly expoService: ExpoService,
    private readonly matching: TripMatchingService,     
    
    
 
    
    
    
  ) {}
 
  /**
   * Create a new trip
   */
  async createTrip(userId: string, dto: CreateDriverTripDto, em?: EntityManager): Promise<Trip> {
    //this.logger.debug(`Creating trip for driver ${userId}`);
    const manager = em ?? this.tripRepo.manager;
        // Validate driver exists
        const driver = await this.driverRepo.findOne({ where: { userId } });
        if (!driver) {
          this.logger.warn(`Driver not found for userId: ${userId}`);
          throw new NotFoundException('Driver profile not found');
        }
 
        // ── Eligibility checks ──────────────────────────────────────────
if (!driver.licenseVerified) {
  throw new BadRequestException(
    "Please verify your driver's license before creating a trip",
  );
}
 

// ── Resolve the vehicle: if the client named one, it must belong to
//    this driver; otherwise fall back to the driver's own vehicle ──────
let vehicle: Vehicle | null;

if (dto.vehicleId) {
  vehicle = await this.vehicleRepo.findOne({
    where: { id: dto.vehicleId, driverId: driver.id },
  });
  if (!vehicle) {
    throw new NotFoundException('Vehicle not found or does not belong to you');
  }
} else {
  vehicle = await this.vehicleRepo.findOne({
    where: { driverId: driver.id },
  });
  if (!vehicle) {
    throw new BadRequestException('Please register a vehicle before creating a trip');
  }
}

// ── Seats can't exceed the vehicle's approved capacity ────────────────
if (dto.totalSeats > vehicle.capacity) {
  throw new BadRequestException(
    `This vehicle is approved for ${vehicle.capacity} seat(s), so you can't offer ${dto.totalSeats}. ` +
      `Please set the number of seats to ${vehicle.capacity} or fewer.`,
  );
}
 
 

 
    // Validate trip data
    this.validateTripData(dto);
 
      // Generate unique reference
    const reference = this.randomnessUtil.generateReference('TRP');
 
 
     // Create trip entity
     const trip = this.tripRepo.create({
  reference,                                  
  driverId: driver.id,
  departureDate: dto.departureDate,
  departureTime: dto.departureTime,
  departureLocation: dto.departureLocation,
  departureLatlong: dto.departureLatlong,
  arrivalDate: dto.arrivalDate,
  arrivalTime: dto.arrivalTime,
  arrivalDestination: dto.arrivalDestination,
  pickStation: dto.pickStation,
  dropOffStation: dto.dropOffStation,
  busStop: dto.busStop,
  busstopLatlong: dto.busstopLatlong,
  tripSpecification: dto.tripSpecification,
  waypoints: dto.waypoints,                   // ← entity has it
  state: dto.arrivalDestination?.[0]?.state,
  description: dto.description,               // ← entity has it
  vehicleFeatures: dto.vehicleFeatures,                   // ← entity has it (string[])
  metadata: dto.metadata,                     // ← entity has it
  bookingClosingDate: dto.bookingClosingDate,
  bookingClosingTime: dto.bookingClosingTime,
  price: dto.price,
  vehicleId: dto.vehicleId,
  totalSeats: dto.totalSeats,                 // ← from DTO now
  availableSeats: dto.availableSeats,         // ← from DTO now
  status: TripStatus.PENDING,
});
 
    
        const savedTrip = await manager.save(Trip, trip);
        
        this.logger.log(
          `Trip created successfully: ${reference} by driver ${driver.id}`,
        );
 
        // Notify the driver
await this.notifiyService.notify({
  userId: userId,                          // driver's userId
  title: 'Trip Created Successfully',
  body: `Your trip (${reference}) from ${dto.departureLocation} to ${dto.dropOffStation} has been created and is pending approval.`,
  type: NotificationType.TRIP_CREATED,    
  data: {
    tripId: savedTrip.id,
    reference: savedTrip.reference,
    status: savedTrip.status,
  },
});
//send push

try {
          await this.matching.fulfillRequestsForTrip(
            {
              tripId: savedTrip.id,
              origin: dto.departureLocation,
              destination:
                dto.arrivalDestination?.[0]?.name ?? dto.dropOffStation,
              date: dto.departureDate,
            },
            manager,
          );
        } catch (err) {
          this.logger.warn(
            `Auto-approve on trip create failed: ${err?.message}`,
          );
        }

        return savedTrip;
  }
     
        //return savedTrip;
 
  
 
   async updateProfile(
      id: string,
      dto: UpdateDriverProfileDto,
      entityManager?: EntityManager,
    ) {
     
      return this.driverRepository.updateDriver(id, dto, entityManager);
    }
 
    
 
  /**
   * Update trip details (only PENDING trips)
   */

  /**
   * Update trip details (only PENDING trips)
   */
  // async updateTrip(userId: string, tripId: string, dto: UpdateDriverTripDto, em?: EntityManager): Promise<Trip> {
  //   this.logger.debug(`Updating trip ${tripId} for driver ${userId}`);
  //   const manager = em ?? this.tripRepo.manager;

  //   // Validate driver and ownership
  //   const trip = await this.getTripOwnedByDriver(userId, tripId);

  //   // Only allow updates on PENDING trips
  //   if (trip.status !== TripStatus.PENDING) {
  //     throw new BadRequestException('Can only update trips in PENDING status');
  //   }

  //   // Check for confirmed bookings
  //   const confirmedCount = await this.bookingRepo.count({
  //     where: { tripId, status: BookingStatus.CONFIRMED },
  //   });

  //   if (confirmedCount > 0) {
  //     throw new BadRequestException('Cannot edit a trip that already has confirmed bookings');
  //   }

  //   // Validate update data
  //   if (dto.departureTime) {
  //     // Normalize "17:08" -> "17:08:00" so Postgres `time` always gets HH:mm:ss
  //     dto.departureTime =
  //       dto.departureTime.length === 5 ? `${dto.departureTime}:00` : dto.departureTime;
  //   }

  //   // Validate departure date+time whenever either is being changed
  //   if (dto.departureDate || dto.departureTime) {
  //     this.validateDepartureDateTime(
  //       dto.departureDate ?? trip.departureDate,
  //       dto.departureTime ?? trip.departureTime,
  //     );
  //   }

  //   const newPrice = dto.price ?? dto.pricePerSeat;
  //   if (newPrice !== undefined && (newPrice < 100 || newPrice > 50000)) {
  //     throw new BadRequestException('Price per seat must be between 100 and 50000');
  //   }

  //   // Apply updates — map DTO fields to actual entity columns.
  //   // IMPORTANT: departureTime stays a STRING ("HH:mm:ss"). Never wrap it in
  //   // new Date() — new Date("17:08:00") is an Invalid Date, and TypeORM
  //   // formats it as "aN:aN:aN" when saving a `time` column.
  //   if (dto.departureDate) trip.departureDate = dto.departureDate;
  //   if (dto.departureTime) trip.departureTime = dto.departureTime;
  //   if (dto.departureLocation ?? dto.origin) trip.departureLocation = dto.departureLocation ?? dto.origin;
  //   if (dto.departureLatlong) trip.departureLatlong = dto.departureLatlong;
  //   if (dto.arrivalDate) trip.arrivalDate = dto.arrivalDate;
  //   if (dto.arrivalTime) {
  //     trip.arrivalTime = dto.arrivalTime.length === 5 ? `${dto.arrivalTime}:00` : dto.arrivalTime;
  //   }
  //   if (dto.arrivalDestination) {
  //     trip.arrivalDestination = dto.arrivalDestination;
  //     trip.state = dto.arrivalDestination?.[0]?.state ?? trip.state;
  //   }
  //   if (dto.pickStation) trip.pickStation = dto.pickStation;
  //   if (dto.dropOffStation ?? dto.destination) trip.dropOffStation = dto.dropOffStation ?? dto.destination;
  //   if (dto.busStop) trip.busStop = dto.busStop;
  //   if (dto.busstopLatlong) trip.busstopLatlong = dto.busstopLatlong;
  //   if (dto.tripSpecification) trip.tripSpecification = dto.tripSpecification;
  //   if (dto.waypoints) trip.waypoints = dto.waypoints;
  //   if (dto.state) trip.state = dto.state;
  //   if (dto.description !== undefined) trip.description = dto.description;
  //   if (dto.vehicleFeatures) trip.vehicleFeatures = dto.vehicleFeatures;
  //   else if (dto.features) trip.vehicleFeatures = this.parseAmenities(dto.features);
  //   if (dto.bookingClosingDate) trip.bookingClosingDate = dto.bookingClosingDate;
  //   if (dto.bookingClosingTime) {
  //     trip.bookingClosingTime =
  //       dto.bookingClosingTime.length === 5 ? `${dto.bookingClosingTime}:00` : dto.bookingClosingTime;
  //   }
  //   if (newPrice !== undefined) trip.price = newPrice;
  //   if (dto.vehicleId) trip.vehicleId = dto.vehicleId;
  //   if (dto.metadata) trip.metadata = { ...trip.metadata, ...dto.metadata };

  //   if (dto.totalSeats !== undefined) {
  //     const booked = trip.bookedSeats ?? 0;
  //     if (dto.totalSeats < booked) {
  //       throw new BadRequestException(
  //         `Total seats cannot be less than already booked seats (${booked})`,
  //       );
  //     }
  //     trip.totalSeats = dto.totalSeats;
  //     trip.availableSeats = dto.totalSeats - booked;
  //   }
    
  //   const updated = await manager.save(Trip, trip);

  //   this.logger.log(`Trip ${tripId} updated by driver ${userId}`);
  //   return updated;
  // }
   async updateTrip(userId: string, tripId: string, dto: UpdateDriverTripDto, em?: EntityManager): Promise<Trip> {
    this.logger.debug(`Updating trip ${tripId} for driver ${userId}`);
    const manager = em ?? this.tripRepo.manager;

    // Validate driver and ownership
    const trip = await this.getTripOwnedByDriver(userId, tripId);

    // Only allow updates on PENDING trips
    if (trip.status !== TripStatus.PENDING) {
      throw new BadRequestException('Can only update trips in PENDING status');
    }

    // Check for confirmed bookings
    const confirmedCount = await this.bookingRepo.count({
      where: { tripId, status: BookingStatus.CONFIRMED },
    });

    if (confirmedCount > 0) {
      throw new BadRequestException('Cannot edit a trip that already has confirmed bookings');
    }

    // Validate update data
    if (dto.departureTime) {
      // Normalize "17:08" -> "17:08:00" so Postgres `time` always gets HH:mm:ss
      dto.departureTime =
        dto.departureTime.length === 5 ? `${dto.departureTime}:00` : dto.departureTime;
    }

    // Validate departure date+time whenever either is being changed
    if (dto.departureDate || dto.departureTime) {
      this.validateDepartureDateTime(
        dto.departureDate ?? trip.departureDate,
        dto.departureTime ?? trip.departureTime,
      );
    }

    const newPrice = dto.price ?? dto.pricePerSeat;
    if (newPrice !== undefined && (newPrice < 100 || newPrice > 50000)) {
      throw new BadRequestException('Price per seat must be between 100 and 50000');
    }

    // Apply updates — map DTO fields to actual entity columns.
    // IMPORTANT: departureTime stays a STRING ("HH:mm:ss"). Never wrap it in
    // new Date() — new Date("17:08:00") is an Invalid Date, and TypeORM
    // formats it as "aN:aN:aN" when saving a `time` column.
    if (dto.departureDate) trip.departureDate = dto.departureDate;
    if (dto.departureTime) trip.departureTime = dto.departureTime;
    if (dto.departureLocation ?? dto.origin) trip.departureLocation = dto.departureLocation ?? dto.origin;
    if (dto.departureLatlong) trip.departureLatlong = dto.departureLatlong;
    if (dto.arrivalDate) trip.arrivalDate = dto.arrivalDate;
    if (dto.arrivalTime) {
      trip.arrivalTime = dto.arrivalTime.length === 5 ? `${dto.arrivalTime}:00` : dto.arrivalTime;
    }
    if (dto.arrivalDestination) {
      trip.arrivalDestination = dto.arrivalDestination;
      trip.state = dto.arrivalDestination?.[0]?.state ?? trip.state;
    }
    if (dto.pickStation) trip.pickStation = dto.pickStation;
    if (dto.dropOffStation ?? dto.destination) trip.dropOffStation = dto.dropOffStation ?? dto.destination;
    if (dto.busStop) trip.busStop = dto.busStop;
    if (dto.busstopLatlong) trip.busstopLatlong = dto.busstopLatlong;
    if (dto.tripSpecification) trip.tripSpecification = dto.tripSpecification;
    if (dto.waypoints) trip.waypoints = dto.waypoints;
    if (dto.state) trip.state = dto.state;
    if (dto.description !== undefined) trip.description = dto.description;
    if (dto.vehicleFeatures) trip.vehicleFeatures = dto.vehicleFeatures;
    else if (dto.features) trip.vehicleFeatures = this.parseAmenities(dto.features);
    if (dto.bookingClosingDate) trip.bookingClosingDate = dto.bookingClosingDate;
    if (dto.bookingClosingTime) {
      trip.bookingClosingTime =
        dto.bookingClosingTime.length === 5 ? `${dto.bookingClosingTime}:00` : dto.bookingClosingTime;
    }
    if (newPrice !== undefined) trip.price = newPrice;
    if (dto.metadata) trip.metadata = { ...trip.metadata, ...dto.metadata };

    // ── Vehicle + seats: keep totalSeats within the vehicle's approved capacity ──
    // Runs when EITHER the seat count OR the vehicle is changing, so downgrading
    // to a smaller vehicle (without touching seats) is also caught.
    if (dto.vehicleId !== undefined || dto.totalSeats !== undefined) {
      // The vehicle this trip will end up on: the new one if swapping, else current.
      const targetVehicleId = dto.vehicleId ?? trip.vehicleId;
      const vehicle = await this.vehicleRepo.findOne({
        where: { id: targetVehicleId, driverId: trip.driverId },
      });
      if (!vehicle) {
        throw new NotFoundException('Vehicle not found or does not belong to you');
      }

      const booked = trip.bookedSeats ?? 0;
      // Seat count after this update (unchanged if only the vehicle is swapped).
      const nextTotalSeats = dto.totalSeats ?? trip.totalSeats;

      if (nextTotalSeats < booked) {
        throw new BadRequestException(
          `Total seats cannot be less than already booked seats (${booked})`,
        );
      }
      if (nextTotalSeats > vehicle.capacity) {
        throw new BadRequestException(
          `This vehicle is approved for ${vehicle.capacity} seat(s), so you can't offer ${nextTotalSeats}. ` +
            `Please set the number of seats to ${vehicle.capacity} or fewer.`,
        );
      }

      // Apply the validated vehicle + seat counts and recompute availability.
      trip.vehicleId = vehicle.id;
      trip.totalSeats = nextTotalSeats;
      trip.availableSeats = nextTotalSeats - booked;
    }

    const updated = await manager.save(Trip, trip);

    this.logger.log(`Trip ${tripId} updated by driver ${userId}`);
    return updated;
  }
 
  async getVehicleType(): Promise<VehicleType[]>{
      return this.driverRepository.getVehicleType()
  }
 
  /**
   * Activate trip (publish for bookings)
   */
  async activateTrip(userId: string, tripId: string, em?: EntityManager): Promise<Trip> {
    this.logger.debug(`Activating trip ${tripId} for driver ${userId}`);
        const manager = em ?? this.tripRepo.manager;
    const trip = await this.getTripOwnedByDriver(userId, tripId);
 
    if (trip.status !== TripStatus.PENDING) {
      throw new BadRequestException(
        `Cannot activate trip. Current status: ${trip.status}. Only PENDING trips can be activated.`,
      );
    }
 
    // const departureDate = new Date(trip.departureTime);
    // const now = new Date();
 
    // if (departureDate <= now) {
    //   throw new BadRequestException('Cannot activate a trip that has already departed or expired');
    // }

    const departure = new Date(`${trip.departureDate}T${trip.departureTime}`);

    if (isNaN(departure.getTime()) || departure <= new Date()) {
      throw new BadRequestException('Cannot activate a trip that has already departed or expired');
    }
 
    trip.status = TripStatus.ACTIVE;
    const updated = await manager.save(Trip, trip);
 
    this.logger.log(`Trip ${tripId} activated by driver ${userId}`);
    return updated;
  
  }
 
  /**
   * Cancel trip (with refunds)
   */
  async cancelTrip(
    userId: string,
    tripId: string,
    dto: CancelDriverTripDto,
    em?: EntityManager,
  ): Promise<{
    trip: Trip;
    refundedBookings: number;
    totalRefundAmount: number;
  }> {
    this.logger.debug(`Cancelling trip ${tripId} for driver ${userId}`);
    const manager = em ?? this.tripRepo.manager;
    const trip = await this.getTripOwnedByDriver(userId, tripId);
 
    if (![TripStatus.PENDING, TripStatus.ACTIVE, TripStatus.STARTED].includes(trip.status)) {
      throw new BadRequestException(
        `Cannot cancel a trip with status: ${trip.status}. Only PENDING, ACTIVE or STARTED trips can be cancelled.`,
      );
    }
 
    // Validate cancellation reason
    if (!dto.reason || dto.reason.trim().length === 0) {
      throw new BadRequestException('Cancellation reason is required');
    }
 
    trip.status = TripStatus.CANCELLED;
    trip.cancelledByDriver = true;                          // ← powers activity analytics
    trip.reasonForTripCancellation = dto.reason.trim();     // ← powers activity analytics
    trip.metadata = {
      ...trip.metadata,
      cancellationReason: dto.reason.trim(),
      additionalNotes: dto.additionalNotes?.trim() || null,
      cancelledAt: new Date().toISOString(),
      cancelledBy: userId,
    };
 
    await manager.save(Trip, trip);
 
    // Get all bookings for this trip
    const bookings = await this.bookingRepo.find({
      where: { tripId: trip.id },
      relations: ['passenger', 'passenger.user'],
    });
 
    let refundedCount = 0;
    let totalRefundAmount = 0;
 
    // Process refunds for PENDING and CONFIRMED bookings
    for (const booking of bookings) {
      if ([BookingStatus.CONFIRMED, BookingStatus.PENDING].includes(booking.status)) {
        // Mark booking as cancelled
        booking.status = BookingStatus.CANCELLED;
        booking.metadata = {
          ...booking.metadata,
          cancelReason: dto.reason.trim(),
          cancelledBy: 'driver',                            // ← excluded from passenger stats
          cancelledAt: new Date().toISOString(),
          refundReason: 'Trip cancelled by driver',
        };
 
        await manager.save(Booking, booking);
 
        // Process escrow refund if payment was successful
        if (booking.paymentStatus === 'success') {
          const refundAmount = await this.processRefund(booking.id, manager);
          totalRefundAmount += refundAmount;
        }
 
        refundedCount++;
      }
    }
 
    this.logger.log(
      `Trip ${tripId} cancelled by driver ${userId}. Refunded ${refundedCount} bookings. Total: ${totalRefundAmount}`,
    );
 
    // Bust the cached dashboard so cancelled-trip counts show immediately
    await this.invalidateDriverDashboardCache(userId);
 
    return {
      trip,
      refundedBookings: refundedCount,
      totalRefundAmount,
    };
  }
 
  /** Remove every cached dashboard page for this driver (all page/limit combos). */
  private async invalidateDriverDashboardCache(userId: string): Promise<void> {
    try {
      await this.cache.delMany(`${CACHE_KEYS.DRIVER_DASHBOARD_STATS}:${userId}:*`);
    } catch (err) {
      this.logger.warn(`Failed to invalidate dashboard cache for ${userId}: ${err?.message}`);
    }
  }
 
  /**
   * Complete trip (release escrows & mark as completed)
   */
  async completeTrip(
    userId: string,
    tripId: string,
    dto: CompleteDriverTripDto,
    em?: EntityManager,
  ): Promise<{
    trip: Trip;
    completedBookings: number;
    totalEarnings: number;
    platformFee: number;
    netEarnings: number;
  }> {
    this.logger.debug(`Completing trip ${tripId} for driver ${userId}`);
    const manager = em ?? this.tripRepo.manager;
    const trip = await this.getTripOwnedByDriver(userId, tripId);
 
    if (![TripStatus.ACTIVE, TripStatus.STARTED].includes(trip.status)) {
      throw new BadRequestException(
        `Cannot complete a trip with status: ${trip.status}. Only ACTIVE or STARTED trips can be completed.`,
      );
    }
 
    trip.status = TripStatus.COMPLETED;
    if (dto.notes) {
      trip.metadata = {
        ...trip.metadata,
        completionNotes: dto.notes.trim(),
        completedAt: new Date().toISOString(),
      };
    }
 
    await manager.save(Trip, trip);
 
    // The driver is paid at boarding time (ticket scan), NOT on completion.
    // Here we only finalise the bookings and report what was already earned
    // via scans for this trip — no wallet credit happens on completion.
    const { completedCount, totalEarnings, platformFeeTotal } = await this.settleTripBookings(
      trip,
      manager,
    );
 
    const netEarnings = totalEarnings - platformFeeTotal;
 
    // Notify the driver that the trip is complete (best-effort)
    try {
      const driver = await this.driverRepo.findOne({ where: { id: trip.driverId } });
      if (driver?.userId) {
        await this.notifiyService.notify({
          userId: driver.userId,
          title: 'Trip Completed',
          body: `Your trip is complete. You earned ₦${netEarnings.toFixed(2)} from ${completedCount} boarded passenger(s) on this trip.`,
          type: NotificationType.TRIP_COMPLETED,
          data: { tripId: trip.id, netEarnings, completedBookings: completedCount },
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to send earnings notification for trip ${trip.id}: ${err?.message}`);
    }
 
    this.logger.log(
      `Trip ${tripId} completed by driver ${userId}. Completed ${completedCount} bookings. Earnings: ${totalEarnings}`,
    );
 
    // Bust the cached dashboard so the new earnings show immediately
    await this.invalidateDriverDashboardCache(userId);
 
    return {
      trip,
      completedBookings: completedCount,
      totalEarnings,
      platformFee: platformFeeTotal,
      netEarnings,
    };
  }
 
async getDriverTripStatus(userId: string, type?: string) {
  return this.driverRepository.getDriverTripStatus(userId, type);
}
 
async getDriverDashboard(userId: string, query: { page?: number; limit?: number }) {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const key = `${CACHE_KEYS.DRIVER_DASHBOARD_STATS}:${userId}:${page}:${limit}`;
  
 return this.cache.getOrSet(
      key,
      () => this.driverRepository.getDriverDashboard(userId, query),
      CACHE_TTL.MEDIUM,
    );
  //return this.driverRepository.getDriverDashboard(userId, query);
}
 
  async getProfile(id: string) {
    return await this.driverRepository.getProfile(id);
  }
 
  //---------------Private Helper Method-----------// 
 private validateTripData(dto: CreateDriverTripDto): void {
  // Combine the date and time into one real timestamp
  const departure = new Date(`${dto.departureDate}T${dto.departureTime}:00`);
  const now = new Date();
 
  // Guard against an unparseable date
  if (isNaN(departure.getTime())) {
    throw new BadRequestException('Invalid departure date or time');
  }
 
  // Departure must be in the future
  if (departure <= now) {
    throw new BadRequestException('Departure time must be in the future');
  }
 
  // Minimum advance notice (2 hours)
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (departure < twoHoursFromNow) {
    throw new BadRequestException('Trip must be created at least 2 hours before departure');
  }
 
  // Origin and destination must be different — but only if BOTH were provided
  if (
    dto.pickStation &&
    dto.dropOffStation &&
    dto.pickStation.toLowerCase() === dto.dropOffStation.toLowerCase()
  ) {
    throw new BadRequestException('Origin and destination must be different');
  }
 
  // Price (min 100, max 50000)
  if (dto.price < 100 || dto.price > 50000) {
    throw new BadRequestException('Price per seat must be between 100 and 50000');
  }
 
  // Seats
  if (dto.availableSeats < 1 || dto.availableSeats > 50) {
    throw new BadRequestException('Total seats must be between 1 and 50');
  }
}
 
    //-------------Private Helper method-----------// 
      private parseAmenities(amenitiesInput: string): string[] {
    if (!amenitiesInput) return [];
    try {
      if (amenitiesInput.startsWith('[')) {
        return JSON.parse(amenitiesInput);
      }
      return amenitiesInput.split(',').map(a => a.trim()).filter(a => a);
    } catch {
      return amenitiesInput.split(',').map(a => a.trim()).filter(a => a);
    }
  }
 
  //------- private helper method ------//
    private async getTripOwnedByDriver(userId: string, tripId: string): Promise<Trip> {
    const driver = await this.driverRepo.findOne({ where: { userId } });
    if (!driver) throw new NotFoundException('Driver profile not found');
 
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driverId: driver.id },
    });
    if (!trip) throw new NotFoundException('Trip not found or does not belong to you');
    return trip;
  }
  
  private validateDepartureDateTime(departureDate: string, departureTime: string): void {
    // Combine "2026-07-20" + "17:08:00" into a parseable datetime
    const departure = new Date(`${departureDate}T${departureTime}`);

    if (isNaN(departure.getTime())) {
      throw new BadRequestException('Invalid departure date/time');
    }

    const now = new Date();

    if (departure <= now) {
      throw new BadRequestException('Departure time must be in the future');
    }

    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    if (departure < twoHoursFromNow) {
      throw new BadRequestException('Trip must be at least 2 hours in the future');
    }
  }

  // --------- //
    private validateDepartureTime(departureTime: string): void {
      const departureDate = new Date(departureTime);
      const now = new Date();
  
      if (departureDate <= now) {
        throw new BadRequestException('Departure time must be in the future');
      }
  
      const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      if (departureDate < twoHoursFromNow) {
        throw new BadRequestException('Trip must be at least 2 hours in the future');
      }
    }
 
    private async processRefund(bookingId: string, manager: EntityManager): Promise<number> {
        const escrow = await this.escrowRepo.findOne({
          where: { bookingId },
          relations: ['booking'],
        });
    
        if (!escrow) {
          return 0;
        }
    
        if (escrow.status === EscrowStatus.HELD) {
          escrow.status = EscrowStatus.REFUNDED;
          escrow.refundedAt = new Date();
          await manager.save(Escrow, escrow);
          return Number(escrow.amount) || 0;
        }
    
        return 0;
      }
 
    /**
     * Finalise a trip's bookings on completion WITHOUT paying the driver.
     *
     * The driver is paid at boarding time when the passenger's ticket is
     * scanned (see TripRepository.scanTicket -> releaseEscrowForBooking), so
     * completion must never credit the wallet again. Here we simply:
     *   - flip CONFIRMED + paid bookings to COMPLETED, and
     *   - report the amount already earned for this trip (from escrows that
     *     were released at scan time) so the response/notification is accurate.
     *
     * Escrows still HELD at completion belong to passengers who paid but were
     * never scanned/boarded; we deliberately leave them untouched so the driver
     * is not credited for no-shows.
     */
    private async settleTripBookings(
      trip: Trip,
      manager: EntityManager,
    ): Promise<{ completedCount: number; totalEarnings: number; platformFeeTotal: number }> {
      const bookings = await manager.find(Booking, {
        where: {
          tripId: trip.id,
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.SUCCESS,
        },
      });
 
      let completedCount = 0;
      for (const booking of bookings) {
        booking.status = BookingStatus.COMPLETED;
        await manager.save(Booking, booking);
        completedCount++;
      }
 
      // Earnings for this trip were already credited at scan time. Sum the
      // escrows that were released on boarding so we can report an accurate
      // figure — this does NOT touch the wallet.
      const releasedEscrows = await this.escrowRepo
        .createQueryBuilder('e')
        .innerJoin('e.booking', 'b')
        .where('b.tripId = :tripId', { tripId: trip.id })
        .andWhere('e.status = :status', { status: EscrowStatus.RELEASED })
        .andWhere("(e.releaseReason IS NULL OR e.releaseReason NOT ILIKE '%bypassed%')")
        .getMany();
 
      let totalEarnings = 0;
      let platformFeeTotal = 0;
      for (const escrow of releasedEscrows) {
        totalEarnings += Number(escrow.amount) || 0;
        platformFeeTotal += Number(escrow.platformFee) || 0;
      }
 
      return { completedCount, totalEarnings, platformFeeTotal };
    }
 
    private async releaseEscrowsForTrip(
    tripId: string,
    manager: EntityManager,
  ): Promise<{ completedCount: number; totalEarnings: number; platformFeeTotal: number }> {
    const escrows = await this.escrowRepo.find({
      where: { status: EscrowStatus.HELD },
      relations: ['booking'],
    });
 
    const tripEscrows = escrows.filter((e) => e.booking?.tripId === tripId);
 
    let completedCount = 0;
    let totalEarnings = 0;
    let platformFeeTotal = 0;
 
    for (const escrow of tripEscrows) {
      escrow.status = EscrowStatus.RELEASED;
      escrow.releasedAt = new Date();
      escrow.releaseReason = 'Trip completed';
      await manager.save(Escrow, escrow);
 
      // Credit driver wallet
      await manager.increment(
        Driver,
        { id: escrow.driverId },
        'currentBalance',
        Number(escrow.netDriverAmount),
      );
 
      completedCount++;
      totalEarnings += Number(escrow.amount) || 0;
      platformFeeTotal += Number(escrow.platformFee) || 0;
 
      this.logger.log(
        `Escrow ${escrow.reference} released → driver ${escrow.driverId} +${escrow.netDriverAmount}`,
      );
    }
 
    return { completedCount, totalEarnings, platformFeeTotal };
  }
}












