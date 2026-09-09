import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { RolesGuard } from '@shared/guards/roles.guard';
import { DriverOnly, PassengerOnly } from '@shared/decorators/roles.decorator';
import { AuthUser } from '@shared/decorators/authUser.decorator';
import { Public } from '@shared/decorators/isPublic.decorator';
import { ServiceName } from '@shared/decorators/servicename.decorators';
import { TripsService } from '../service/trip.service';
import {
  BookTripDto,
  CancelBookingDto,
  CancelTripDto,
  CompleteTripDto,
  CreateTripDto,
  FareEstimateQueryDto,
  PriceRecommendationQueryDto,
  ScanTicketDto,
  SearchTripsDto,
  TripListQueryDto,
  UpdateTripDto,
} from '../dtos/trip.dto';
import { string } from 'joi';
import { CreateTripUsecase } from '../usecases/createtrip.usecase';
import { Broker } from '@broker/broker';
import { SearchTripUsecase } from '../usecases/searchtrip.usecase';
import { GetTripUsecase } from '../usecases/gettrip.usecase';
import { ActivateTripUsecase } from '../usecases/activatetrip.usecase';
import { UpdateTripUsecase } from '../usecases/updatetrip.usecase';
import { CompleteTripUsecase } from '../usecases/completetrip.usecase';
import { CancleTripUsecase } from '../usecases/cancletrip.usecase';
import { GetMyTripUsecase } from '../usecases/getmytrip.usecase';
import { GetMyBookingsUsecase } from '../usecases/getmybooking.usecase';
import { GetTripBookingsUsecase } from '../usecases/gettripbookings.usecase';
import { CheckInPassengerUsecase } from '../usecases/checkinpassenger.usecase';
import { CancleBookingUsecase } from '../usecases/canclebooking.usecase';
import { GetBookingCodeUsecase } from '../usecases/getbookingcode.usecase';
import { BookTripUsecase } from '../usecases/booktrip.usecase';
import { ScanTicketUsecase } from '../usecases/scanticket.usecase';
import { GetBoardingQrUsecase } from '../usecases/getboardingqr.usecase';
import { SearchTripStateUsecase } from '../usecases/searchtripstate.usecase';
import { VerifyBookingUsecase } from '../usecases/verifybooking.usecase';
import { CloseBookingsUsecase } from '../usecases/closebookings.usecase';
import { StartTripUsecase } from '../usecases/starttrip.usecase';
import { GetTripChartSummaryUsecase } from '../usecases/gettripchartsummary.usecase';
import { GetTripActivityUsecase } from '../usecases/gettripactivity.usecase';
import { TripBookingsQueryDto, TripChartQueryDto, VerifyBookingDto } from '../dtos/trip.dto';
import { GetCancellationReasonsUsecase } from '../usecases/getcancelreason.usecase';
import { SkipThrottle } from '@nestjs/throttler';
import { GetTripSummaryByIdUsecase } from '../usecases/gettripsummarybyid.usecase';
import { SearchTripAlterUsecase } from '../usecases/Searchtripalter.usecase';
import { RecommendTripPriceUsecase } from '../usecases/recommendtripprice.usecase';
import { EstimateFareUsecase } from '../usecases/estimatefare.usecase';

@ApiTags('Trips')
@ApiBearerAuth()
@ServiceName('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/trips')
export class TripsController {
  constructor(
    private readonly broker: Broker,
    private readonly createTripUsecase:CreateTripUsecase,
    private readonly searchTripeUsecase: SearchTripUsecase,
    private readonly getTripUsecase: GetTripUsecase,
    private readonly activateTripUsecase:ActivateTripUsecase,
    private readonly updateTripUsecase:UpdateTripUsecase,
    private readonly completeTripUsecase: CompleteTripUsecase,
    private readonly cancleTripUsecase:CancleTripUsecase,
    private readonly getMyTripUsecase:GetMyTripUsecase,
    private readonly getMyBookingsUsecase:GetMyBookingsUsecase,
    private readonly getTripBookingUsecase:GetTripBookingsUsecase,
    private readonly checkInPassengerUsecase:CheckInPassengerUsecase,
    private readonly cancleBookingUsecase:CancleBookingUsecase,
    private readonly getBookingCodeUsecase:GetBookingCodeUsecase,
    private readonly bookTripUsecase:BookTripUsecase,
    private readonly scanTicketUsecase:ScanTicketUsecase,
    private readonly getBoardingQrUsecase:GetBoardingQrUsecase,
    private readonly searchTripStateUsecase:SearchTripStateUsecase,
    private readonly verifyBookingUsecase:VerifyBookingUsecase,
    private readonly closeBookingsUsecase:CloseBookingsUsecase,
    private readonly startTripUsecase:StartTripUsecase,
    private readonly getTripChartSummaryUsecase:GetTripChartSummaryUsecase,
    private readonly getTripActivityUsecase:GetTripActivityUsecase,
      private readonly getCancellationReasonsUsecase:GetCancellationReasonsUsecase,
      private readonly getTripSummaryByIdUsecase: GetTripSummaryByIdUsecase,
      private readonly searchTripAlterUsecase:SearchTripAlterUsecase,
      private readonly recommendTripPriceUsecase:RecommendTripPriceUsecase,
      private readonly estimateFareUsecase:EstimateFareUsecase
  
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // PUBLIC — search & view (no auth required)
  // ──────────────────────────────────────────────────────────────────────────

  @Public()
  @SkipThrottle()
  @Get('search-trip')
  @ApiOperation({
    summary: 'Search available trips',
    description: 'Filter by origin, destination, date, seats, price. Publicly accessible.',
  })
  searchTrips(@Query() dto: SearchTripsDto) {
    return this.broker.runUsecases([this.searchTripeUsecase], dto)
  }


  @Public()
  @SkipThrottle()
  @Get('search-trip-alter')
  @ApiOperation({
    summary: 'Search available alternative trips',
    description: 'Filter by origin, destination, date, seats, price. Publicly accessible.',
  })
  searchTripsAlter(@Query() dto: SearchTripsDto) {
    return this.broker.runUsecases([this.searchTripAlterUsecase], dto)
  }

  @Public()
  @SkipThrottle()
  @Get('search-state')
  @ApiOperation({
    summary: 'Search available trips',
    description: 'Filter by state',
  })
  searchTripState(@Query() dto: SearchTripsDto) {
    return this.broker.runUsecases([this.searchTripStateUsecase], dto)
  }

  @Public()
  @Get('get-trip/:tripId')
  @ApiOperation({ summary: 'Get trip detail by ID' })
  @ApiParam({ name: 'tripId', type: string })
  getTripById(
    @Param("tripId") tripId: string,
  ) {
    return this.broker.runUsecases([this.getTripUsecase], {tripId: tripId})
  }

  @Public()
  @Get('cancellation/reasons')
  @ApiOperation({
    summary: 'Get trip cancellation reasons',
    description:
      'Returns the list of predefined cancellation reasons. Optionally filter with ?audience=driver or ?audience=passenger.',
  })
  getCancellationReasons(@Query('audience') audience?: string) {
    return this.broker.runUsecases([this.getCancellationReasonsUsecase], {
      audience: audience,
    });
  }

  @Public()
  @SkipThrottle()
  @Get('fare-estimate')
  @ApiOperation({
    summary: 'Estimated fare for 1–N passengers on a route',
    description:
      'Shown when a searched trip is not available and the passenger goes to request one. ' +
      'Returns the recommended per-seat price and the total for 1 up to `seats` (default 4) passengers, ' +
      'so passengers know what they will spend and roughly what a driver could charge per seat.',
  })
  fareEstimate(@Query() dto: FareEstimateQueryDto) {
    return this.broker.runUsecases([this.estimateFareUsecase], dto);
  }

  // @DriverOnly()
  // @Get('driver/price-recommendation')
  // @ApiOperation({
  //   summary: 'Driver: Recommended per-seat price for a route',
  //   description:
  //     'Returns a fair recommended fare plus the min/max band the driver may price within. ' +
  //     'Prevents exaggerated pricing while still letting the driver set a price around the recommendation. ' +
  //     'The same band is enforced when the trip is created.',
  // })
  // priceRecommendation(@Query() dto: PriceRecommendationQueryDto) {
  //   return this.broker.runUsecases([this.recommendTripPriceUsecase], dto);
  // }

    @DriverOnly()
  @Get('driver/price-recommendation')
  @ApiOperation({
    summary: 'Driver: Recommended per-seat price + total trip cost for a route',
    description:
      'Returns a fair recommended per-seat price plus the total trip cost. ' +
      '`totalTripCost` (= `maxTotal`) is the MAXIMUM — every seat filled — and is ' +
      'what the driver app should show as the total; `minTotal` is a single seat. ' +
      'Pass `seats` (the vehicle capacity) for the true maximum; it defaults to 4.',
  })
  priceRecommendation(@Query() dto: PriceRecommendationQueryDto) {
    return this.broker.runUsecases([this.recommendTripPriceUsecase], dto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DRIVER routes
  // ──────────────────────────────────────────────────────────────────────────

  @DriverOnly()
  @Post('driver/create-trip')
  @ApiOperation({
    summary: 'Driver: Create a new trip',
    description: 'Trip starts in PENDING state. Call /activate to open it for bookings.',
  })
  createTrip(@AuthUser() user: any,@Body() dto: CreateTripDto) {
    return this.broker.runUsecases([this.createTripUsecase], {id:user.sub, dto:dto})
  }

  @DriverOnly()
@Get('summary/:id')
@ApiOperation({ summary: 'Driver: Full summary for a single trip' })
@ApiParam({ name: 'id', description: 'Trip ID' })
getTripSummaryById(@AuthUser() user: any, @Param('id') id: string) {
  return this.broker.runUsecases([this.getTripSummaryByIdUsecase], {
    tripId: id,
    driverUserId: user.sub,
  });
}

  @DriverOnly()
  @Patch(':tripId/drivers/activate-trip')
  @ApiOperation({ summary: 'Driver: Activate trip — opens it for bookings' })
  activateTrip(@AuthUser() user: any, @Param('tripId') tripId: string) {
    return this.broker.runUsecases([this.activateTripUsecase], {id:user.sub, tripId: tripId})
  }

  @DriverOnly()
  @Put(':tripId/drivers/update-trip')
  @ApiOperation({ summary: 'Driver: Update trip details (no confirmed bookings required)' })
  updateTrip(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
    @Body() dto: UpdateTripDto
  ) {
    return this.broker.runUsecases([this.updateTripUsecase],{ id: user.id, tripId: tripId, dto: dto})
  }

  @DriverOnly()
  @Post('driver/complete-trip')
  @ApiOperation({
    summary: 'Driver: Mark trip as completed',
    description:
      'Releases escrow funds to driver wallet. All confirmed bookings become completed.',
  })
  completeTrip(@AuthUser() user: any, @Body() dto: CompleteTripDto) {
    return this.broker.runUsecases([this.completeTripUsecase], {id:user.sub, dto: dto})
  }

  @DriverOnly()
  @Post('cancel')
  @ApiOperation({
    summary: 'Driver: Cancel trip',
    description: 'Cancels trip and initiates refunds for all confirmed passengers.',
  })
  cancelTrip(@AuthUser() user: any, @Body() dto: CancelTripDto) {
    return this.broker.runUsecases([this.cancleTripUsecase], {id: user.sub, dto:dto})
  }

  @DriverOnly()
  @Get('driver/my-trips')
  @ApiOperation({ summary: 'Driver: List my trips' })
  getMyTrips(
      @AuthUser() user?: any,
    @Query() query?: TripListQueryDto

  ) {
    return this.broker.runUsecases([this.getMyTripUsecase], {id:user.sub, dto: query})
  }

  @DriverOnly()
  @Get(':tripId/bookings')
  @ApiOperation({
    summary: 'Driver: View all bookings for a trip',
    description: 'Optionally filter by passenger name, email, phone, booking code or status via ?search=',
  })
  getTripBookings(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
    @Query() query?: TripBookingsQueryDto,
  ) {
    return this.broker.runUsecases([this.getTripBookingUsecase], {id:user.sub, tripId: tripId, search: query?.search})
  }

  @DriverOnly()
  @Post('bookings/verify')
  @ApiOperation({
    summary: 'Driver: Verify a booking manually by code',
    description:
      'QR fallback for when the passenger cannot present a scannable ticket. Credits the driver exactly like a scan; idempotent.',
  })
  verifyBooking(@AuthUser() user: any, @Body() dto: VerifyBookingDto) {
    return this.broker.runUsecases([this.verifyBookingUsecase], { id: user.sub, dto });
  }

  @DriverOnly()
  @Patch(':tripId/drivers/close-bookings')
  @ApiOperation({ summary: 'Driver: Close bookings on a trip (trip stays active)' })
  closeBookings(@AuthUser() user: any, @Param('tripId') tripId: string) {
    return this.broker.runUsecases([this.closeBookingsUsecase], { id: user.sub, tripId, open: false });
  }

  @DriverOnly()
  @Patch(':tripId/drivers/open-bookings')
  @ApiOperation({ summary: 'Driver: Reopen bookings on a trip' })
  openBookings(@AuthUser() user: any, @Param('tripId') tripId: string) {
    return this.broker.runUsecases([this.closeBookingsUsecase], { id: user.sub, tripId, open: true });
  }

  @DriverOnly()
  @Patch(':tripId/drivers/start-trip')
  @ApiOperation({
    summary: 'Driver: Start trip',
    description: 'Marks the trip as STARTED and notifies every confirmed passenger.',
  })
  startTrip(@AuthUser() user: any, @Param('tripId') tripId: string) {
    return this.broker.runUsecases([this.startTripUsecase], { id: user.sub, tripId });
  }

  @DriverOnly()
  @Get('driver/summary')
  @ApiOperation({
    summary: 'Driver: Trip summary chart data',
    description: 'Trip counts bucketed hourly (daily), by weekday (weekly), by day (monthly) or by month (yearly), plus a detailed trip list for the window.',
  })
  tripSummary(@AuthUser() user: any, @Query() query: TripChartQueryDto) {
    return this.broker.runUsecases([this.getTripChartSummaryUsecase], { id: user.sub, filterBy: query?.filter_by });
  }

  @DriverOnly()
  @Get('driver/activity')
  @ApiOperation({
    summary: 'Driver: Cancellation activity analytics',
    description: 'Driver vs passenger cancellation counts and a reasons breakdown normalized to percentages.',
  })
  tripActivity(@AuthUser() user: any) {
    return this.broker.runUsecases([this.getTripActivityUsecase], { id: user.sub });
  }

  @DriverOnly()
  @Patch('bookings/:bookingId/check-in')
  @ApiOperation({ summary: 'Driver: Check in a passenger at boarding' })
  checkIn(@AuthUser() user: any, @Param('bookingId') bookingId: string) {
    return this.broker.runUsecases([this.checkInPassengerUsecase], {id: user.sub, bookingId: bookingId})
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PASSENGER routes
  // ──────────────────────────────────────────────────────────────────────────

  @PassengerOnly()
  @Post('book')
  @ApiOperation({
    summary: 'Passenger: Book a trip seat',
    description:
      'Returns a Paystack payment link. Funds are held in escrow and released to the driver only after trip completion.',
  })
  bookTrip(@AuthUser() user: any, @Body() dto: BookTripDto) {
    return this.broker.runUsecases([this.bookTripUsecase], {id: user.sub, dto: dto})
  }

  @PassengerOnly()
  @Get('passenger/my-bookings')
  @ApiOperation({ summary: 'Passenger: List my bookings' })
  getMyBookings(
    @Query() query?: TripListQueryDto,
    @AuthUser() user?: any,
  ) {
    return this.broker.runUsecases([this.getMyBookingsUsecase], {id:user.sub, dto:query})
  }

  @PassengerOnly()
  @Post('bookings/cancel')
  @ApiOperation({
    summary: 'Passenger: Cancel a booking',
    description: 'Must cancel at least 2 hours before departure. Refund is initiated automatically.',
  })
  cancelBooking(@AuthUser() user: any, @Body() dto: CancelBookingDto) {
    return this.broker.runUsecases([this.cancleBookingUsecase], {id:user.sub, dto: dto})
  }

  @PassengerOnly()
  @Get('bookings/:code')
  @ApiOperation({ summary: 'Passenger: Get booking by code' })
  getBooking(@AuthUser() user: any, @Param('code') code: string) {
    return this.broker.runUsecases([this.getBookingCodeUsecase], {id: user.sub, bookingCode:code})
  }

  @DriverOnly()
@Post('tickets/scan')
@ApiOperation({ summary: 'Driver: Scan a boarding ticket — credits driver instantly' })
scanTicket(@AuthUser() user: any, @Body() dto: ScanTicketDto) {
  return this.broker.runUsecases([this.scanTicketUsecase], { id: user.sub, dto });
}

@PassengerOnly()
@Get('bookings/:code/qr')
@ApiOperation({ summary: 'Passenger: Get boarding QR code (SVG) for a paid booking' })
getBoardingQr(@AuthUser() user: any, @Param('code') code: string) {
  return this.broker.runUsecases([this.getBoardingQrUsecase], { id: user.sub, bookingCode: code });
}

}



// import {
//   Body,
//   Controller,
//   Get,
//   Param,
//   ParseIntPipe,
//   Patch,
//   Post,
//   Put,
//   Query,
//   UseGuards,
// } from '@nestjs/common';
// import {
//   ApiBearerAuth,
//   ApiOperation,
//   ApiParam,
//   ApiTags,
// } from '@nestjs/swagger';
// import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
// import { RolesGuard } from '@shared/guards/roles.guard';
// import { DriverOnly, PassengerOnly } from '@shared/decorators/roles.decorator';
// import { AuthUser } from '@shared/decorators/authUser.decorator';
// import { Public } from '@shared/decorators/isPublic.decorator';
// import { ServiceName } from '@shared/decorators/servicename.decorators';
// import { TripsService } from '../service/trip.service';
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
// import { string } from 'joi';
// import { CreateTripUsecase } from '../usecases/createtrip.usecase';
// import { Broker } from '@broker/broker';
// import { SearchTripUsecase } from '../usecases/searchtrip.usecase';
// import { GetTripUsecase } from '../usecases/gettrip.usecase';
// import { ActivateTripUsecase } from '../usecases/activatetrip.usecase';
// import { UpdateTripUsecase } from '../usecases/updatetrip.usecase';
// import { CompleteTripUsecase } from '../usecases/completetrip.usecase';
// import { CancleTripUsecase } from '../usecases/cancletrip.usecase';
// import { GetMyTripUsecase } from '../usecases/getmytrip.usecase';
// import { GetMyBookingsUsecase } from '../usecases/getmybooking.usecase';
// import { GetTripBookingsUsecase } from '../usecases/gettripbookings.usecase';
// import { CheckInPassengerUsecase } from '../usecases/checkinpassenger.usecase';
// import { CancleBookingUsecase } from '../usecases/canclebooking.usecase';
// import { GetBookingCodeUsecase } from '../usecases/getbookingcode.usecase';
// import { BookTripUsecase } from '../usecases/booktrip.usecase';
// import { ScanTicketUsecase } from '../usecases/scanticket.usecase';
// import { GetBoardingQrUsecase } from '../usecases/getboardingqr.usecase';
// import { SearchTripStateUsecase } from '../usecases/searchtripstate.usecase';
// import { VerifyBookingUsecase } from '../usecases/verifybooking.usecase';
// import { CloseBookingsUsecase } from '../usecases/closebookings.usecase';
// import { StartTripUsecase } from '../usecases/starttrip.usecase';
// import { GetTripChartSummaryUsecase } from '../usecases/gettripchartsummary.usecase';
// import { GetTripActivityUsecase } from '../usecases/gettripactivity.usecase';
// import { TripBookingsQueryDto, TripChartQueryDto, VerifyBookingDto } from '../dtos/trip.dto';
// import { GetCancellationReasonsUsecase } from '../usecases/getcancelreason.usecase';
// import { SkipThrottle } from '@nestjs/throttler';
// import { GetTripSummaryByIdUsecase } from '../usecases/gettripsummarybyid.usecase';
// import { SearchTripAlterUsecase } from '../usecases/Searchtripalter.usecase';

// @ApiTags('Trips')
// @ApiBearerAuth()
// @ServiceName('trips')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('v1/trips')
// export class TripsController {
//   constructor(
//     private readonly broker: Broker,
//     private readonly createTripUsecase:CreateTripUsecase,
//     private readonly searchTripeUsecase: SearchTripUsecase,
//     private readonly getTripUsecase: GetTripUsecase,
//     private readonly activateTripUsecase:ActivateTripUsecase,
//     private readonly updateTripUsecase:UpdateTripUsecase,
//     private readonly completeTripUsecase: CompleteTripUsecase,
//     private readonly cancleTripUsecase:CancleTripUsecase,
//     private readonly getMyTripUsecase:GetMyTripUsecase,
//     private readonly getMyBookingsUsecase:GetMyBookingsUsecase,
//     private readonly getTripBookingUsecase:GetTripBookingsUsecase,
//     private readonly checkInPassengerUsecase:CheckInPassengerUsecase,
//     private readonly cancleBookingUsecase:CancleBookingUsecase,
//     private readonly getBookingCodeUsecase:GetBookingCodeUsecase,
//     private readonly bookTripUsecase:BookTripUsecase,
//     private readonly scanTicketUsecase:ScanTicketUsecase,
//     private readonly getBoardingQrUsecase:GetBoardingQrUsecase,
//     private readonly searchTripStateUsecase:SearchTripStateUsecase,
//     private readonly verifyBookingUsecase:VerifyBookingUsecase,
//     private readonly closeBookingsUsecase:CloseBookingsUsecase,
//     private readonly startTripUsecase:StartTripUsecase,
//     private readonly getTripChartSummaryUsecase:GetTripChartSummaryUsecase,
//     private readonly getTripActivityUsecase:GetTripActivityUsecase,
//       private readonly getCancellationReasonsUsecase:GetCancellationReasonsUsecase,
//       private readonly getTripSummaryByIdUsecase: GetTripSummaryByIdUsecase,
//       private readonly searchTripAlterUsecase:SearchTripAlterUsecase
  
//   ) {}

//   // ──────────────────────────────────────────────────────────────────────────
//   // PUBLIC — search & view (no auth required)
//   // ──────────────────────────────────────────────────────────────────────────

//   @Public()
//   @SkipThrottle()
//   @Get('search-trip')
//   @ApiOperation({
//     summary: 'Search available trips',
//     description: 'Filter by origin, destination, date, seats, price. Publicly accessible.',
//   })
//   searchTrips(@Query() dto: SearchTripsDto) {
//     return this.broker.runUsecases([this.searchTripeUsecase], dto)
//   }


//   @Public()
//   @SkipThrottle()
//   @Get('search-trip-alter')
//   @ApiOperation({
//     summary: 'Search available alternative trips',
//     description: 'Filter by origin, destination, date, seats, price. Publicly accessible.',
//   })
//   searchTripsAlter(@Query() dto: SearchTripsDto) {
//     return this.broker.runUsecases([this.searchTripAlterUsecase], dto)
//   }

//   @Public()
//   @SkipThrottle()
//   @Get('search-state')
//   @ApiOperation({
//     summary: 'Search available trips',
//     description: 'Filter by state',
//   })
//   searchTripState(@Query() dto: SearchTripsDto) {
//     return this.broker.runUsecases([this.searchTripStateUsecase], dto)
//   }

//   @Public()
//   @Get('get-trip/:tripId')
//   @ApiOperation({ summary: 'Get trip detail by ID' })
//   @ApiParam({ name: 'tripId', type: string })
//   getTripById(
//     @Param("tripId") tripId: string,
//   ) {
//     return this.broker.runUsecases([this.getTripUsecase], {tripId: tripId})
//   }

//   @Public()
//   @Get('cancellation/reasons')
//   @ApiOperation({
//     summary: 'Get trip cancellation reasons',
//     description:
//       'Returns the list of predefined cancellation reasons. Optionally filter with ?audience=driver or ?audience=passenger.',
//   })
//   getCancellationReasons(@Query('audience') audience?: string) {
//     return this.broker.runUsecases([this.getCancellationReasonsUsecase], {
//       audience: audience,
//     });
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   // DRIVER routes
//   // ──────────────────────────────────────────────────────────────────────────

//   @DriverOnly()
//   @Post('driver/create-trip')
//   @ApiOperation({
//     summary: 'Driver: Create a new trip',
//     description: 'Trip starts in PENDING state. Call /activate to open it for bookings.',
//   })
//   createTrip(@AuthUser() user: any,@Body() dto: CreateTripDto) {
//     return this.broker.runUsecases([this.createTripUsecase], {id:user.sub, dto:dto})
//   }

//   @DriverOnly()
// @Get('summary/:id')
// @ApiOperation({ summary: 'Driver: Full summary for a single trip' })
// @ApiParam({ name: 'id', description: 'Trip ID' })
// getTripSummaryById(@AuthUser() user: any, @Param('id') id: string) {
//   return this.broker.runUsecases([this.getTripSummaryByIdUsecase], {
//     tripId: id,
//     driverUserId: user.sub,
//   });
// }

//   @DriverOnly()
//   @Patch(':tripId/drivers/activate-trip')
//   @ApiOperation({ summary: 'Driver: Activate trip — opens it for bookings' })
//   activateTrip(@AuthUser() user: any, @Param('tripId') tripId: string) {
//     return this.broker.runUsecases([this.activateTripUsecase], {id:user.sub, tripId: tripId})
//   }

//   @DriverOnly()
//   @Put(':tripId/drivers/update-trip')
//   @ApiOperation({ summary: 'Driver: Update trip details (no confirmed bookings required)' })
//   updateTrip(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//     @Body() dto: UpdateTripDto
//   ) {
//     return this.broker.runUsecases([this.updateTripUsecase],{ id: user.id, tripId: tripId, dto: dto})
//   }

//   @DriverOnly()
//   @Post('driver/complete-trip')
//   @ApiOperation({
//     summary: 'Driver: Mark trip as completed',
//     description:
//       'Releases escrow funds to driver wallet. All confirmed bookings become completed.',
//   })
//   completeTrip(@AuthUser() user: any, @Body() dto: CompleteTripDto) {
//     return this.broker.runUsecases([this.completeTripUsecase], {id:user.sub, dto: dto})
//   }

//   @DriverOnly()
//   @Post('cancel')
//   @ApiOperation({
//     summary: 'Driver: Cancel trip',
//     description: 'Cancels trip and initiates refunds for all confirmed passengers.',
//   })
//   cancelTrip(@AuthUser() user: any, @Body() dto: CancelTripDto) {
//     return this.broker.runUsecases([this.cancleTripUsecase], {id: user.sub, dto:dto})
//   }

//   @DriverOnly()
//   @Get('driver/my-trips')
//   @ApiOperation({ summary: 'Driver: List my trips' })
//   getMyTrips(
//       @AuthUser() user?: any,
//     @Query() query?: TripListQueryDto

//   ) {
//     return this.broker.runUsecases([this.getMyTripUsecase], {id:user.sub, dto: query})
//   }

//   @DriverOnly()
//   @Get(':tripId/bookings')
//   @ApiOperation({
//     summary: 'Driver: View all bookings for a trip',
//     description: 'Optionally filter by passenger name, email, phone, booking code or status via ?search=',
//   })
//   getTripBookings(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//     @Query() query?: TripBookingsQueryDto,
//   ) {
//     return this.broker.runUsecases([this.getTripBookingUsecase], {id:user.sub, tripId: tripId, search: query?.search})
//   }

//   @DriverOnly()
//   @Post('bookings/verify')
//   @ApiOperation({
//     summary: 'Driver: Verify a booking manually by code',
//     description:
//       'QR fallback for when the passenger cannot present a scannable ticket. Credits the driver exactly like a scan; idempotent.',
//   })
//   verifyBooking(@AuthUser() user: any, @Body() dto: VerifyBookingDto) {
//     return this.broker.runUsecases([this.verifyBookingUsecase], { id: user.sub, dto });
//   }

//   @DriverOnly()
//   @Patch(':tripId/drivers/close-bookings')
//   @ApiOperation({ summary: 'Driver: Close bookings on a trip (trip stays active)' })
//   closeBookings(@AuthUser() user: any, @Param('tripId') tripId: string) {
//     return this.broker.runUsecases([this.closeBookingsUsecase], { id: user.sub, tripId, open: false });
//   }

//   @DriverOnly()
//   @Patch(':tripId/drivers/open-bookings')
//   @ApiOperation({ summary: 'Driver: Reopen bookings on a trip' })
//   openBookings(@AuthUser() user: any, @Param('tripId') tripId: string) {
//     return this.broker.runUsecases([this.closeBookingsUsecase], { id: user.sub, tripId, open: true });
//   }

//   @DriverOnly()
//   @Patch(':tripId/drivers/start-trip')
//   @ApiOperation({
//     summary: 'Driver: Start trip',
//     description: 'Marks the trip as STARTED and notifies every confirmed passenger.',
//   })
//   startTrip(@AuthUser() user: any, @Param('tripId') tripId: string) {
//     return this.broker.runUsecases([this.startTripUsecase], { id: user.sub, tripId });
//   }

//   @DriverOnly()
//   @Get('driver/summary')
//   @ApiOperation({
//     summary: 'Driver: Trip summary chart data',
//     description: 'Trip counts bucketed hourly (daily), by weekday (weekly), by day (monthly) or by month (yearly), plus a detailed trip list for the window.',
//   })
//   tripSummary(@AuthUser() user: any, @Query() query: TripChartQueryDto) {
//     return this.broker.runUsecases([this.getTripChartSummaryUsecase], { id: user.sub, filterBy: query?.filter_by });
//   }

//   @DriverOnly()
//   @Get('driver/activity')
//   @ApiOperation({
//     summary: 'Driver: Cancellation activity analytics',
//     description: 'Driver vs passenger cancellation counts and a reasons breakdown normalized to percentages.',
//   })
//   tripActivity(@AuthUser() user: any) {
//     return this.broker.runUsecases([this.getTripActivityUsecase], { id: user.sub });
//   }

//   @DriverOnly()
//   @Patch('bookings/:bookingId/check-in')
//   @ApiOperation({ summary: 'Driver: Check in a passenger at boarding' })
//   checkIn(@AuthUser() user: any, @Param('bookingId') bookingId: string) {
//     return this.broker.runUsecases([this.checkInPassengerUsecase], {id: user.sub, bookingId: bookingId})
//   }

//   // ──────────────────────────────────────────────────────────────────────────
//   // PASSENGER routes
//   // ──────────────────────────────────────────────────────────────────────────

//   @PassengerOnly()
//   @Post('book')
//   @ApiOperation({
//     summary: 'Passenger: Book a trip seat',
//     description:
//       'Returns a Paystack payment link. Funds are held in escrow and released to the driver only after trip completion.',
//   })
//   bookTrip(@AuthUser() user: any, @Body() dto: BookTripDto) {
//     return this.broker.runUsecases([this.bookTripUsecase], {id: user.sub, dto: dto})
//   }

//   @PassengerOnly()
//   @Get('passenger/my-bookings')
//   @ApiOperation({ summary: 'Passenger: List my bookings' })
//   getMyBookings(
//     @Query() query?: TripListQueryDto,
//     @AuthUser() user?: any,
//   ) {
//     return this.broker.runUsecases([this.getMyBookingsUsecase], {id:user.sub, dto:query})
//   }

//   @PassengerOnly()
//   @Post('bookings/cancel')
//   @ApiOperation({
//     summary: 'Passenger: Cancel a booking',
//     description: 'Must cancel at least 2 hours before departure. Refund is initiated automatically.',
//   })
//   cancelBooking(@AuthUser() user: any, @Body() dto: CancelBookingDto) {
//     return this.broker.runUsecases([this.cancleBookingUsecase], {id:user.sub, dto: dto})
//   }

//   @PassengerOnly()
//   @Get('bookings/:code')
//   @ApiOperation({ summary: 'Passenger: Get booking by code' })
//   getBooking(@AuthUser() user: any, @Param('code') code: string) {
//     return this.broker.runUsecases([this.getBookingCodeUsecase], {id: user.sub, bookingCode:code})
//   }

//   @DriverOnly()
// @Post('tickets/scan')
// @ApiOperation({ summary: 'Driver: Scan a boarding ticket — credits driver instantly' })
// scanTicket(@AuthUser() user: any, @Body() dto: ScanTicketDto) {
//   return this.broker.runUsecases([this.scanTicketUsecase], { id: user.sub, dto });
// }

// @PassengerOnly()
// @Get('bookings/:code/qr')
// @ApiOperation({ summary: 'Passenger: Get boarding QR code (SVG) for a paid booking' })
// getBoardingQr(@AuthUser() user: any, @Param('code') code: string) {
//   return this.broker.runUsecases([this.getBoardingQrUsecase], { id: user.sub, bookingCode: code });
// }

// }

// // import {
// //   Body,
// //   Controller,
// //   Get,
// //   Param,
// //   ParseIntPipe,
// //   Patch,
// //   Post,
// //   Put,
// //   Query,
// //   UseGuards,
// // } from '@nestjs/common';
// // import {
// //   ApiBearerAuth,
// //   ApiOperation,
// //   ApiParam,
// //   ApiTags,
// // } from '@nestjs/swagger';
// // import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
// // import { RolesGuard } from '@shared/guards/roles.guard';
// // import { DriverOnly, PassengerOnly } from '@shared/decorators/roles.decorator';
// // import { AuthUser } from '@shared/decorators/authUser.decorator';
// // import { Public } from '@shared/decorators/isPublic.decorator';
// // import { ServiceName } from '@shared/decorators/servicename.decorators';
// // import { TripsService } from '../service/trip.service';
// // import {
// //   BookTripDto,
// //   CancelBookingDto,
// //   CancelTripDto,
// //   CompleteTripDto,
// //   CreateTripDto,
// //   ScanTicketDto,
// //   SearchTripsDto,
// //   TripListQueryDto,
// //   UpdateTripDto,
// // } from '../dtos/trip.dto';
// // import { string } from 'joi';
// // import { CreateTripUsecase } from '../usecases/createtrip.usecase';
// // import { Broker } from '@broker/broker';
// // import { SearchTripUsecase } from '../usecases/searchtrip.usecase';
// // import { GetTripUsecase } from '../usecases/gettrip.usecase';
// // import { ActivateTripUsecase } from '../usecases/activatetrip.usecase';
// // import { UpdateTripUsecase } from '../usecases/updatetrip.usecase';
// // import { CompleteTripUsecase } from '../usecases/completetrip.usecase';
// // import { CancleTripUsecase } from '../usecases/cancletrip.usecase';
// // import { GetMyTripUsecase } from '../usecases/getmytrip.usecase';
// // import { GetMyBookingsUsecase } from '../usecases/getmybooking.usecase';
// // import { GetTripBookingsUsecase } from '../usecases/gettripbookings.usecase';
// // import { CheckInPassengerUsecase } from '../usecases/checkinpassenger.usecase';
// // import { CancleBookingUsecase } from '../usecases/canclebooking.usecase';
// // import { GetBookingCodeUsecase } from '../usecases/getbookingcode.usecase';
// // import { BookTripUsecase } from '../usecases/booktrip.usecase';
// // import { ScanTicketUsecase } from '../usecases/scanticket.usecase';
// // import { GetBoardingQrUsecase } from '../usecases/getboardingqr.usecase';
// // import { SearchTripStateUsecase } from '../usecases/searchtripstate.usecase';

// // @ApiTags('Trips')
// // @ApiBearerAuth()
// // @ServiceName('trips')
// // @UseGuards(JwtAuthGuard, RolesGuard)
// // @Controller('v1/trips')
// // export class TripsController {
// //   constructor(
// //     private readonly broker: Broker,
// //     private readonly createTripUsecase:CreateTripUsecase,
// //     private readonly searchTripeUsecase: SearchTripUsecase,
// //     private readonly getTripUsecase: GetTripUsecase,
// //     private readonly activateTripUsecase:ActivateTripUsecase,
// //     private readonly updateTripUsecase:UpdateTripUsecase,
// //     private readonly completeTripUsecase: CompleteTripUsecase,
// //     private readonly cancleTripUsecase:CancleTripUsecase,
// //     private readonly getMyTripUsecase:GetMyTripUsecase,
// //     private readonly getMyBookingsUsecase:GetMyBookingsUsecase,
// //     private readonly getTripBookingUsecase:GetTripBookingsUsecase,
// //     private readonly checkInPassengerUsecase:CheckInPassengerUsecase,
// //     private readonly cancleBookingUsecase:CancleBookingUsecase,
// //     private readonly getBookingCodeUsecase:GetBookingCodeUsecase,
// //     private readonly bookTripUsecase:BookTripUsecase,
// //     private readonly scanTicketUsecase:ScanTicketUsecase,
// //     private readonly getBoardingQrUsecase:GetBoardingQrUsecase,
// //     private readonly searchTripStateUsecase:SearchTripStateUsecase
  
// //   ) {}

// //   // ──────────────────────────────────────────────────────────────────────────
// //   // PUBLIC — search & view (no auth required)
// //   // ──────────────────────────────────────────────────────────────────────────

// //   @Public()
// //   @Get('search-trip')
// //   @ApiOperation({
// //     summary: 'Search available trips',
// //     description: 'Filter by origin, destination, date, seats, price. Publicly accessible.',
// //   })
// //   searchTrips(@Query() dto: SearchTripsDto) {
// //     return this.broker.runUsecases([this.searchTripeUsecase], dto)
// //   }

// //   @Public()
// //   @Get('search-state')
// //   @ApiOperation({
// //     summary: 'Search available trips',
// //     description: 'Filter by state',
// //   })
// //   searchTripState(@Query() dto: SearchTripsDto) {
// //     return this.broker.runUsecases([this.searchTripStateUsecase], dto)
// //   }

// //   @Public()
// //   @Get('get-trip/:tripId')
// //   @ApiOperation({ summary: 'Get trip detail by ID' })
// //   @ApiParam({ name: 'tripId', type: string })
// //   getTripById(
// //     @Param("tripId") tripId: string,
// //   ) {
// //     return this.broker.runUsecases([this.getTripUsecase], {tripId: tripId})
// //   }

// //   // ──────────────────────────────────────────────────────────────────────────
// //   // DRIVER routes
// //   // ──────────────────────────────────────────────────────────────────────────

// //   @DriverOnly()
// //   @Post('driver/create-trip')
// //   @ApiOperation({
// //     summary: 'Driver: Create a new trip',
// //     description: 'Trip starts in PENDING state. Call /activate to open it for bookings.',
// //   })
// //   createTrip(@AuthUser() user: any,@Body() dto: CreateTripDto) {
// //     return this.broker.runUsecases([this.createTripUsecase], {id:user.sub, dto:dto})
// //   }

// //   @DriverOnly()
// //   @Patch(':tripId/drivers/activate-trip')
// //   @ApiOperation({ summary: 'Driver: Activate trip — opens it for bookings' })
// //   activateTrip(@AuthUser() user: any, @Param('tripId') tripId: string) {
// //     return this.broker.runUsecases([this.activateTripUsecase], {id:user.sub, tripId: tripId})
// //   }

// //   @DriverOnly()
// //   @Put(':tripId/drivers/update-trip')
// //   @ApiOperation({ summary: 'Driver: Update trip details (no confirmed bookings required)' })
// //   updateTrip(
// //     @AuthUser() user: any,
// //     @Param('tripId') tripId: string,
// //     @Body() dto: UpdateTripDto
// //   ) {
// //     return this.broker.runUsecases([this.updateTripUsecase],{ id: user.id, tripId: tripId, dto: dto})
// //   }

// //   @DriverOnly()
// //   @Post('driver/complete-trip')
// //   @ApiOperation({
// //     summary: 'Driver: Mark trip as completed',
// //     description:
// //       'Releases escrow funds to driver wallet. All confirmed bookings become completed.',
// //   })
// //   completeTrip(@AuthUser() user: any, @Body() dto: CompleteTripDto) {
// //     return this.broker.runUsecases([this.completeTripUsecase], {id:user.sub, dto: dto})
// //   }

// //   @DriverOnly()
// //   @Post('cancel')
// //   @ApiOperation({
// //     summary: 'Driver: Cancel trip',
// //     description: 'Cancels trip and initiates refunds for all confirmed passengers.',
// //   })
// //   cancelTrip(@AuthUser() user: any, @Body() dto: CancelTripDto) {
// //     return this.broker.runUsecases([this.cancleTripUsecase], {id: user.sub, dto:dto})
// //   }

// //   @DriverOnly()
// //   @Get('driver/my-trips')
// //   @ApiOperation({ summary: 'Driver: List my trips' })
// //   getMyTrips(
// //       @AuthUser() user?: any,
// //     @Query() query?: TripListQueryDto

// //   ) {
// //     return this.broker.runUsecases([this.getMyTripUsecase], {id:user.sub, dto: query})
// //   }

// //   @DriverOnly()
// //   @Get(':tripId/bookings')
// //   @ApiOperation({ summary: 'Driver: View all bookings for a trip' })
// //   getTripBookings( @AuthUser() user: any, @Param('tripId') tripId: string) {
// //     return this.broker.runUsecases([this.getTripBookingUsecase], {id:user.sub, tripId: tripId})
// //   }

// //   @DriverOnly()
// //   @Patch('bookings/:bookingId/check-in')
// //   @ApiOperation({ summary: 'Driver: Check in a passenger at boarding' })
// //   checkIn(@AuthUser() user: any, @Param('bookingId') bookingId: string) {
// //     return this.broker.runUsecases([this.checkInPassengerUsecase], {id: user.sub, bookingId: bookingId})
// //   }

// //   // ──────────────────────────────────────────────────────────────────────────
// //   // PASSENGER routes
// //   // ──────────────────────────────────────────────────────────────────────────

// //   @PassengerOnly()
// //   @Post('book')
// //   @ApiOperation({
// //     summary: 'Passenger: Book a trip seat',
// //     description:
// //       'Returns a Paystack payment link. Funds are held in escrow and released to the driver only after trip completion.',
// //   })
// //   bookTrip(@AuthUser() user: any, @Body() dto: BookTripDto) {
// //     return this.broker.runUsecases([this.bookTripUsecase], {id: user.sub, dto: dto})
// //   }

// //   @PassengerOnly()
// //   @Get('passenger/my-bookings')
// //   @ApiOperation({ summary: 'Passenger: List my bookings' })
// //   getMyBookings(
// //     @Query() query?: TripListQueryDto,
// //     @AuthUser() user?: any,
// //   ) {
// //     return this.broker.runUsecases([this.getMyBookingsUsecase], {id:user.sub, dto:query})
// //   }

// //   @PassengerOnly()
// //   @Post('bookings/cancel')
// //   @ApiOperation({
// //     summary: 'Passenger: Cancel a booking',
// //     description: 'Must cancel at least 2 hours before departure. Refund is initiated automatically.',
// //   })
// //   cancelBooking(@AuthUser() user: any, @Body() dto: CancelBookingDto) {
// //     return this.broker.runUsecases([this.cancleBookingUsecase], {id:user.sub, dto: dto})
// //   }

// //   @PassengerOnly()
// //   @Get('bookings/:code')
// //   @ApiOperation({ summary: 'Passenger: Get booking by code' })
// //   getBooking(@AuthUser() user: any, @Param('code') code: string) {
// //     return this.broker.runUsecases([this.getBookingCodeUsecase], {id: user.sub, bookingCode:code})
// //   }

// //   @DriverOnly()
// // @Post('tickets/scan')
// // @ApiOperation({ summary: 'Driver: Scan a boarding ticket — credits driver instantly' })
// // scanTicket(@AuthUser() user: any, @Body() dto: ScanTicketDto) {
// //   return this.broker.runUsecases([this.scanTicketUsecase], { id: user.sub, dto });
// // }

// // @PassengerOnly()
// // @Get('bookings/:code/qr')
// // @ApiOperation({ summary: 'Passenger: Get boarding QR code (SVG) for a paid booking' })
// // getBoardingQr(@AuthUser() user: any, @Param('code') code: string) {
// //   return this.broker.runUsecases([this.getBoardingQrUsecase], { id: user.sub, bookingCode: code });
// // }

// // }