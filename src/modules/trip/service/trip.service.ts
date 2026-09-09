import {

  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {  EntityManager } from 'typeorm';
import * as QRCode from 'qrcode';
import { NotFoundException } from '@nestjs/common';
import { Trip } from '@modules/core/entities/trip.entity';
import { Driver } from '@modules/core/entities/driver.entity';
import { Passenger } from '@modules/core/entities/passenger.entity';
import { FareService } from './fare.service';


import {
  BookTripDto,
  CancelBookingDto,
  CancelTripDto,
  CompleteTripDto,
  CreateTripDto,
  ScanTicketDto,
  SearchTripsDto,
  TripListQueryDto,
  UpdateTripDto,
} from '../dtos/trip.dto';
import { TripRepository } from '@adapters/repositories/trip.repository';
import { TripMatchingService } from '@modules/trip-matching/service/trip-matching.service';
// import { TicketStatus } from 'src/types/enums';



@Injectable()
export class TripsService {
private readonly logger = new Logger(TripsService.name);
  constructor(
    private readonly tripRepository: TripRepository,
    private readonly fareService: FareService,
      private readonly matching: TripMatchingService,

  ) {}

  // ─── Driver: Create trip ──────────────────────────────────────────────────
async createTrip(
  id: string,
  dto: CreateTripDto,
  entityManager?: EntityManager,
): Promise<Trip> {

  // Recommend a fare (distance × admin rate/km) and stamp it on the trip for
  // reference. The driver's chosen price is not restricted.
  const rec = await this.fareService.recommendPrice(dto.origin, dto.destination);
  const dtoWithPriceMeta: CreateTripDto = {
    ...dto,
    metadata: {
      ...(dto.metadata ?? {}),
      fareRecommendation: {
        recommendedPricePerSeat: rec.recommendedPricePerSeat,
        perKmRate: rec.perKmRate,
        distanceKm: rec.distanceKm,
        isInterState: rec.isInterState,
        basis: rec.basis,
        evaluatedAt: new Date().toISOString(),
      },
    },
  };

  const trip = await this.tripRepository.createTrip(id, dtoWithPriceMeta, entityManager);

if (entityManager) {
  try {
    // await this.matching.fulfillRequestsForTrip(
    //   {
    //     tripId: trip.id,
    //     origin: dto.origin,
    //     destination: dto.destination,
    //     date: dto.departureDate,
    //   },
    //   entityManager,
    // );
        await this.matching.fulfillRequestsForTrip(
      {
        tripId: trip.id,
        origin: dto.origin,
        destination: dto.destination,
        date: dto.departureDate,
        departureTime: dto.departureTime,
      },
      entityManager,
    );
  } catch (err) {
    this.logger.warn?.(`Auto-approve on trip create failed: ${err?.message}`);
  }
}

return trip;
  // const trip = await this.tripRepository.createTrip(
  //   id,
  //   dtoWithPriceMeta,
  //   entityManager,
  // );

  // return trip;
}
  // ─── Driver: Activate/publish trip ───────────────────────────────────────

async activateTrip(userId: string, tripId: string): Promise<Trip> {
  return await this.tripRepository.activateTrip(userId, tripId);
}

 getCancellationReasons(audience?: string) {
    const reasons = [
      { id: 1, audience: 'driver', reason: 'Vehicle breakdown' },
      { id: 2, audience: 'driver', reason: 'Personal emergency' },
      { id: 3, audience: 'driver', reason: 'Bad weather conditions' },
      { id: 4, audience: 'driver', reason: 'Not enough passengers booked' },
      { id: 5, audience: 'driver', reason: 'Road closure or unsafe route' },
      { id: 6, audience: 'passenger', reason: 'Change of plans' },
      { id: 7, audience: 'passenger', reason: 'Found another means of transport' },
      { id: 8, audience: 'passenger', reason: 'Booked by mistake' },
      { id: 9, audience: 'passenger', reason: 'Trip departure time changed' },
      { id: 10, audience: 'passenger', reason: 'Emergency / unforeseen circumstances' },
      { id: 11, audience: 'both', reason: 'Other' },
    ];
 
    if (audience && ['driver', 'passenger'].includes(audience)) {
      return reasons.filter(
        (r) => r.audience === audience || r.audience === 'both',
      );
    }
 
    return reasons;
  }


  async searchTripsWithAlternatives(query: SearchTripsDto) {
    const result: any = await this.tripRepository.searchTrips(query);
    const exactCount = result?.meta?.totalRecords ?? 0;
 
    // Only hunt for alternatives when the caller asked for a SPECIFIC date and
    // nothing matched it. An undated search already returns the full list.
    if (query.date && exactCount === 0) {
      const alternatives = await this.tripRepository.findAlternativeTrips({
        origin: query.origin,
        destination: query.destination,
        date: query.date,
        seats: query.seats,
        windowDays: 7,          // look up to a week ahead
        limit: query.limit ?? 10,
      });

      // When the passenger has a route but no matching trip, show what a fair
      // fare would look like for 1–4 seats. This lets them decide whether to
      // request a trip knowing roughly what they'll spend per seat.
      const estimatedFares = await this.buildFareEstimate(query.origin, query.destination);

      return {
        ...result,
        exactDateAvailable: false,
        alternatives,
        estimatedFares,
        // No exact match AND no nearby trips → tell the app to show the
        // "Request a trip / get notified" button.
        canRequestTrip: alternatives.length === 0,
      };
    }
 
    return {
      ...result,
      exactDateAvailable: true,
      alternatives: [],
      estimatedFares: null,
      canRequestTrip: false,
    };
  }

  /** Best-effort per-seat fare estimate (1–4 seats). Never blocks a search. */
  private async buildFareEstimate(origin?: string, destination?: string) {
    if (!origin || !destination) return null;
    try {
      return await this.fareService.estimateForPassengers(origin, destination, 4);
    } catch {
      return null;
    }
  }

  // ─── Driver: Complete trip → release escrow ───────────────────────────────

  async completeTrip(id: string, dto: CompleteTripDto): Promise<Trip> {
    return await this.tripRepository.completeTrip(id, dto);
  }

  // ─── Driver: Cancel trip → refund all bookings ────────────────────────────

  async cancelTrip(id: string, dto: CancelTripDto): Promise<Trip> {
    return await this.tripRepository.cancelTrip(id, dto);
  }

  // ─── Driver: Update trip (before first booking only) ─────────────────────

  async updateTrip(id: string, tripId: string, dto: UpdateTripDto): Promise<Trip> {
    return await  this.tripRepository.updateTrip(id, tripId, dto);
  }

  // ─── Passenger: Search trips ──────────────────────────────────────────────

  async searchTrips(query: SearchTripsDto) {
    return await this.tripRepository.searchTrips(query);
  }

  async searchTripState(query: SearchTripsDto){
    return this.tripRepository.searchTripState(query);
  }

  async scanTicket(driverUserId: string, dto: ScanTicketDto, em?: EntityManager) {
  return this.tripRepository.scanTicket(driverUserId, dto, em);
}

  // ─── Passenger: Get single trip ───────────────────────────────────────────

  async getTripById(tripId: string) {
   return await this.tripRepository.getTripById(tripId);
  }

  // ─── Passenger: Book trip → initiate payment → hold escrow ───────────────

  async bookTrip(id: string, dto: BookTripDto,   entityManager?: EntityManager,
) {
   return await this.tripRepository.bookTrip(id, dto, entityManager);
  }

async getTripSummaryById(tripId: string, driverUserId?: string) {
  return await this.tripRepository.getTripSummaryById(tripId, driverUserId);
}

  // ─── Called by webhook: payment confirmed → create escrow ─────────────────

  // async confirmBookingPayment(
  //   bookingId: string,
  //   paymentReference: string,
  //   entityManager?: EntityManager,
  // ) {
  //  return await this.tripRepository.confirmBookingPayment(bookingId, paymentReference, entityManager);
  // }

  // ─── Passenger: Cancel booking ────────────────────────────────────────────

  async cancelBooking(id: string, dto: CancelBookingDto, entityManager?: EntityManager) {
      return await this.tripRepository.cancelBooking(id, dto, entityManager);
  }

  // ─── Get my bookings (passenger) ─────────────────────────────────────────

  async getMyBookings(id: string, query: TripListQueryDto) {
   return await this.tripRepository.getMyBookings(id, query)
  }

  // ─── Get my trips (driver) ────────────────────────────────────────────────

  async getMyTrips(id: string, query: TripListQueryDto) {
   return await this.tripRepository.getMyTrips(id, query);
  }

  // ─── Get trip bookings (driver) — optional passenger search ──────────────

  async getTripBookings(id: string, tripId: string, search?: string) {
    return await  this.tripRepository.getTripBookings(id, tripId, search);
  }

  // ─── Driver: Verify booking manually by code (QR fallback) ───────────────

  async verifyBookingByCode(id: string, bookingCode: string, em?: EntityManager) {
    return await this.tripRepository.verifyBookingByCode(id, bookingCode, em);
  }

  // ─── Driver: Close / reopen bookings on a trip ───────────────────────────

  async setBookingStatus(id: string, tripId: string, open: boolean, em?: EntityManager) {
    return await this.tripRepository.setBookingStatus(id, tripId, open, em);
  }

  // ─── Driver: Start trip → notify passengers ──────────────────────────────

  async startTrip(id: string, tripId: string, em?: EntityManager) {
    return await this.tripRepository.startTrip(id, tripId, em);
  }

  // ─── Driver: Trip summary charts (daily/weekly/monthly/yearly) ───────────

  async getTripChartSummary(id: string, filterBy?: 'daily' | 'weekly' | 'monthly' | 'yearly') {
    return await this.tripRepository.getTripChartSummary(id, filterBy);
  }

  // ─── Driver: Cancellation activity analytics ─────────────────────────────

  async getTripActivity(id: string) {
    return await this.tripRepository.getTripActivity(id);
  }

  // ─── Driver: Check-in passenger ──────────────────────────────────────────

  async checkInPassenger(id: string, bookingId: string) {
    return await this.tripRepository.checkInPassenger(id, bookingId);
  }

  // ─── Get booking detail ───────────────────────────────────────────────────

  async getBookingByCode( id: string, bookingCode: string,) {
    return await this.tripRepository.getBookingByCode( id, bookingCode,)
  }

 

  async getBoardingQr(userId: string, bookingCode: string): Promise<{ svg: string; payload: string }> {
  // reuse your ownership-checked fetch
  const booking = await this.tripRepository.getBookingByCode( userId, bookingCode,);

  // if (booking.ticketStatus !== TicketStatus.ISSUED) {
  //   throw new ForbiddenException('Ticket is not available for boarding (unpaid, scanned, or void)');
  // }
  if (!booking.ticketToken) {
    throw new NotFoundException('No ticket issued for this booking');
  }

  // The driver's scanner reads this JSON; the scan endpoint re-validates the token.
  const payload = JSON.stringify({
    bookingCode: booking.bookingCode,
    ticketToken: booking.ticketToken,
  });

  const svg = await QRCode.toString(payload, { type: 'svg', width: 300, margin: 1 });
  return { svg, payload };
}



  
}


// import {

//   Injectable,
// } from '@nestjs/common';
// import {  EntityManager } from 'typeorm';
// import * as QRCode from 'qrcode';
// import { NotFoundException } from '@nestjs/common';
// import { Trip } from '@modules/core/entities/trip.entity';
// import { Driver } from '@modules/core/entities/driver.entity';
// import { Passenger } from '@modules/core/entities/passenger.entity';


// import {
//   BookTripDto,
//   CancelBookingDto,
//   CancelTripDto,
//   CompleteTripDto,
//   CreateTripDto,
//   ScanTicketDto,
//   SearchTripsDto,
//   TripListQueryDto,
//   UpdateTripDto,
// } from '../dtos/trip.dto';
// import { TripRepository } from '@adapters/repositories/trip.repository';
// // import { TicketStatus } from 'src/types/enums';



// @Injectable()
// export class TripsService {

//   constructor(
//     private readonly tripRepository: TripRepository
//   ) {}

//   // ─── Driver: Create trip ──────────────────────────────────────────────────
// async createTrip(
//   id: string,
//   dto: CreateTripDto,
//   entityManager?: EntityManager,
// ): Promise<Trip> {


//   const trip = await this.tripRepository.createTrip(
//     id,
//     dto,
//     entityManager,
//   );

//   return trip;
// }
//   // ─── Driver: Activate/publish trip ───────────────────────────────────────

// async activateTrip(userId: string, tripId: string): Promise<Trip> {
//   return await this.tripRepository.activateTrip(userId, tripId);
// }

//  getCancellationReasons(audience?: string) {
//     const reasons = [
//       { id: 1, audience: 'driver', reason: 'Vehicle breakdown' },
//       { id: 2, audience: 'driver', reason: 'Personal emergency' },
//       { id: 3, audience: 'driver', reason: 'Bad weather conditions' },
//       { id: 4, audience: 'driver', reason: 'Not enough passengers booked' },
//       { id: 5, audience: 'driver', reason: 'Road closure or unsafe route' },
//       { id: 6, audience: 'passenger', reason: 'Change of plans' },
//       { id: 7, audience: 'passenger', reason: 'Found another means of transport' },
//       { id: 8, audience: 'passenger', reason: 'Booked by mistake' },
//       { id: 9, audience: 'passenger', reason: 'Trip departure time changed' },
//       { id: 10, audience: 'passenger', reason: 'Emergency / unforeseen circumstances' },
//       { id: 11, audience: 'both', reason: 'Other' },
//     ];
 
//     if (audience && ['driver', 'passenger'].includes(audience)) {
//       return reasons.filter(
//         (r) => r.audience === audience || r.audience === 'both',
//       );
//     }
 
//     return reasons;
//   }


//   async searchTripsWithAlternatives(query: SearchTripsDto) {
//     const result: any = await this.tripRepository.searchTrips(query);
//     const exactCount = result?.meta?.totalRecords ?? 0;
 
//     // Only hunt for alternatives when the caller asked for a SPECIFIC date and
//     // nothing matched it. An undated search already returns the full list.
//     if (query.date && exactCount === 0) {
//       const alternatives = await this.tripRepository.findAlternativeTrips({
//         origin: query.origin,
//         destination: query.destination,
//         date: query.date,
//         seats: query.seats,
//         windowDays: 7,          // look up to a week ahead
//         limit: query.limit ?? 10,
//       });
 
//       return {
//         ...result,
//         exactDateAvailable: false,
//         alternatives,
//         // No exact match AND no nearby trips → tell the app to show the
//         // "Request a trip / get notified" button.
//         canRequestTrip: alternatives.length === 0,
//       };
//     }
 
//     return {
//       ...result,
//       exactDateAvailable: true,
//       alternatives: [],
//       canRequestTrip: false,
//     };
//   }

//   // ─── Driver: Complete trip → release escrow ───────────────────────────────

//   async completeTrip(id: string, dto: CompleteTripDto): Promise<Trip> {
//     return await this.tripRepository.completeTrip(id, dto);
//   }

//   // ─── Driver: Cancel trip → refund all bookings ────────────────────────────

//   async cancelTrip(id: string, dto: CancelTripDto): Promise<Trip> {
//     return await this.tripRepository.cancelTrip(id, dto);
//   }

//   // ─── Driver: Update trip (before first booking only) ─────────────────────

//   async updateTrip(id: string, tripId: string, dto: UpdateTripDto): Promise<Trip> {
//     return await  this.tripRepository.updateTrip(id, tripId, dto);
//   }

//   // ─── Passenger: Search trips ──────────────────────────────────────────────

//   async searchTrips(query: SearchTripsDto) {
//     return await this.tripRepository.searchTrips(query);
//   }

//   async searchTripState(query: SearchTripsDto){
//     return this.tripRepository.searchTripState(query);
//   }

//   async scanTicket(driverUserId: string, dto: ScanTicketDto, em?: EntityManager) {
//   return this.tripRepository.scanTicket(driverUserId, dto, em);
// }

//   // ─── Passenger: Get single trip ───────────────────────────────────────────

//   async getTripById(tripId: string) {
//    return await this.tripRepository.getTripById(tripId);
//   }

//   // ─── Passenger: Book trip → initiate payment → hold escrow ───────────────

//   async bookTrip(id: string, dto: BookTripDto,   entityManager?: EntityManager,
// ) {
//    return await this.tripRepository.bookTrip(id, dto, entityManager);
//   }

// async getTripSummaryById(tripId: string, driverUserId?: string) {
//   return await this.tripRepository.getTripSummaryById(tripId, driverUserId);
// }

//   // ─── Called by webhook: payment confirmed → create escrow ─────────────────

//   // async confirmBookingPayment(
//   //   bookingId: string,
//   //   paymentReference: string,
//   //   entityManager?: EntityManager,
//   // ) {
//   //  return await this.tripRepository.confirmBookingPayment(bookingId, paymentReference, entityManager);
//   // }

//   // ─── Passenger: Cancel booking ────────────────────────────────────────────

//   async cancelBooking(id: string, dto: CancelBookingDto, entityManager?: EntityManager) {
//       return await this.tripRepository.cancelBooking(id, dto, entityManager);
//   }

//   // ─── Get my bookings (passenger) ─────────────────────────────────────────

//   async getMyBookings(id: string, query: TripListQueryDto) {
//    return await this.tripRepository.getMyBookings(id, query)
//   }

//   // ─── Get my trips (driver) ────────────────────────────────────────────────

//   async getMyTrips(id: string, query: TripListQueryDto) {
//    return await this.tripRepository.getMyTrips(id, query);
//   }

//   // ─── Get trip bookings (driver) — optional passenger search ──────────────

//   async getTripBookings(id: string, tripId: string, search?: string) {
//     return await  this.tripRepository.getTripBookings(id, tripId, search);
//   }

//   // ─── Driver: Verify booking manually by code (QR fallback) ───────────────

//   async verifyBookingByCode(id: string, bookingCode: string, em?: EntityManager) {
//     return await this.tripRepository.verifyBookingByCode(id, bookingCode, em);
//   }

//   // ─── Driver: Close / reopen bookings on a trip ───────────────────────────

//   async setBookingStatus(id: string, tripId: string, open: boolean, em?: EntityManager) {
//     return await this.tripRepository.setBookingStatus(id, tripId, open, em);
//   }

//   // ─── Driver: Start trip → notify passengers ──────────────────────────────

//   async startTrip(id: string, tripId: string, em?: EntityManager) {
//     return await this.tripRepository.startTrip(id, tripId, em);
//   }

//   // ─── Driver: Trip summary charts (daily/weekly/monthly/yearly) ───────────

//   async getTripChartSummary(id: string, filterBy?: 'daily' | 'weekly' | 'monthly' | 'yearly') {
//     return await this.tripRepository.getTripChartSummary(id, filterBy);
//   }

//   // ─── Driver: Cancellation activity analytics ─────────────────────────────

//   async getTripActivity(id: string) {
//     return await this.tripRepository.getTripActivity(id);
//   }

//   // ─── Driver: Check-in passenger ──────────────────────────────────────────

//   async checkInPassenger(id: string, bookingId: string) {
//     return await this.tripRepository.checkInPassenger(id, bookingId);
//   }

//   // ─── Get booking detail ───────────────────────────────────────────────────

//   async getBookingByCode( id: string, bookingCode: string,) {
//     return await this.tripRepository.getBookingByCode( id, bookingCode,)
//   }

 

//   async getBoardingQr(userId: string, bookingCode: string): Promise<{ svg: string; payload: string }> {
//   // reuse your ownership-checked fetch
//   const booking = await this.tripRepository.getBookingByCode( userId, bookingCode,);

//   // if (booking.ticketStatus !== TicketStatus.ISSUED) {
//   //   throw new ForbiddenException('Ticket is not available for boarding (unpaid, scanned, or void)');
//   // }
//   if (!booking.ticketToken) {
//     throw new NotFoundException('No ticket issued for this booking');
//   }

//   // The driver's scanner reads this JSON; the scan endpoint re-validates the token.
//   const payload = JSON.stringify({
//     bookingCode: booking.bookingCode,
//     ticketToken: booking.ticketToken,
//   });

//   const svg = await QRCode.toString(payload, { type: 'svg', width: 300, margin: 1 });
//   return { svg, payload };
// }



  
// }
