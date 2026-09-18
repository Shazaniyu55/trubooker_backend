import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,

} from '@nestjs/common';
import { ApiTags, ApiParam, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthUser } from '@shared/decorators/authUser.decorator';

import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';

import {
  CreateDriverTripDto,
  UpdateDriverTripDto,
  CancelDriverTripDto,
  CompleteDriverTripDto,
  CreateTripResponseDto,
  CancelTripResponseDto,
  ActivateTripResponseDto,
  CompleteTripResponseDto,
  DriverTripResponseDto,
  DriverTripDetailResponseDto,
  DriverBookingResponseDto,
} from '../dtos/create-driver.dto';
import { Broker } from '@broker/broker';
import { CreateDriverTripUsecase } from '../usecases/createTrip.usecase';
import { RolesGuard } from '@shared/guards/roles.guard';
import { DriverOnly } from '@shared/decorators/roles.decorator';
import { UpdateDriverTripUsecase } from '../usecases/updateTrip.usecase';
import { ActivateDriverTripUsecase } from '../usecases/activatetrip.usecase';
import { CancleDriverTripUsecase } from '../usecases/cancletrip.usecase';
import { CompleteDriverTripUsecase } from '../usecases/completetrip.usecase';
import { GetTripBookingsUsecase } from '@modules/trip/usecases/gettripbookings.usecase';
import { CheckInPassengerUsecase } from '@modules/trip/usecases/checkinpassenger.usecase';
import { GetTripUsecase } from '@modules/trip/usecases/gettrip.usecase';
import { GetMyTripUsecase } from '@modules/trip/usecases/getmytrip.usecase';
import { CloseBookingsUsecase } from '@modules/trip/usecases/closebookings.usecase';
import { TripListQueryDto } from '@modules/trip/dtos/trip.dto';
import { InitiatePayoutDto } from '../dtos/payout.dto';
import { InitiatePayoutUsecase } from '../usecases/initiatepayout.usecase';
import { UpdateDriverProfileDto } from '../dtos/updatedriver.dto';
import { DriverTripService } from '../services/driver.service';
import { GetVehicleTypeUsecase } from '../usecases/getvehicletype.usecase';
import { GetDriverTripStatusUsecase } from '../usecases/getdrivertripstatus.usecase';
import { GetDriverDashboardUsecase } from '../usecases/getdriverdashboard.usecase';
import { TripStatus } from 'src/types/enums';
import { GetDriverProfileUsecase } from '../usecases/getdriverprofile.usecase';
import { PayoutService } from '../services/payout.service';
import { WalletTxQueryDto } from '../dtos/wallet-query.dto';
import { NotificationService } from '@modules/notification/services/notification.service';
import { DeleteDriverAccountUsecase } from '../usecases/deleteacct.usecase';
import { DeleteUserDto } from '../dtos/deleteuser.dto';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DRIVER TRIP CONTROLLER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles all driver-initiated trip operations:
 * - Create, Update, Activate, Cancel, Complete trips
 * - Retrieve trip details and bookings
 */

@ApiTags('Driver - Trips')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('v1/drivers')
export class DriverTripController {
  constructor(
    private readonly broker: Broker,
    private readonly createDriverTripUsecase: CreateDriverTripUsecase,
    private readonly updateDriverTripUsecase:UpdateDriverTripUsecase,
    private readonly activateDriverTripUsecase:ActivateDriverTripUsecase,
    private readonly cancleDriverTripUsecase:CancleDriverTripUsecase,
    private readonly completeDriverTripUseCase:CompleteDriverTripUsecase,
    private readonly getTripBookingsUseCase:GetTripBookingsUsecase,
    private readonly checkInPassengerUsecase: CheckInPassengerUsecase,
    private readonly getTripUsecase:GetTripUsecase,
    private readonly getMyTripUsecase:GetMyTripUsecase,
    private readonly closeBookingsUsecase:CloseBookingsUsecase,
    private readonly initiatePayoutUsecase: InitiatePayoutUsecase,
    private readonly driverService: DriverTripService,
    private readonly getVehicleTypeUsecase:GetVehicleTypeUsecase,
    private readonly getDriverTripStatusUsecase: GetDriverTripStatusUsecase,
    private readonly getDriverDashboardUsecase: GetDriverDashboardUsecase,
    private readonly getDriverProfileUsecase:GetDriverProfileUsecase,
    private readonly payoutService: PayoutService,
        private readonly notificationService: NotificationService,
         private readonly deleteDriverAccountUsecase: DeleteDriverAccountUsecase,
    
  ) {}

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * CREATE TRIP
   * ─────────────────────────────────────────────────────────────────────────
   */
@DriverOnly()
@Post('trip/create')
@HttpCode(HttpStatus.CREATED)
async createTrip(
  @AuthUser() user: any,
  @Body() dto: CreateDriverTripDto,
): Promise<CreateTripResponseDto> {
  return this.broker.runUsecases([this.createDriverTripUsecase], {id: user.sub, dto: dto})
 
}

@DriverOnly()
@Post('payout/initiate')
@ApiOperation({ summary: 'Driver: Request a withdrawal' })
initiatePayout(@AuthUser() user: any, @Body() dto: InitiatePayoutDto) {
  return this.broker.runUsecases([this.initiatePayoutUsecase], { id: user.sub, dto });
}

@DriverOnly()
@Get('payout/banks')
@ApiOperation({ summary: 'Fetch supported bank list' })
getBanks() {
  return this.payoutService.getBankList();
}

@DriverOnly()
@Delete('delete-acct')
@ApiOperation({
  summary: 'Delete my driver account',
  description:
    'Soft-deletes my account. Refused while I have an upcoming/active/in-progress trip, or an un-withdrawn wallet balance.',
})
deleteAccount(@AuthUser() user: any, @Body() dto: DeleteUserDto) {
  return this.broker.runUsecases([this.deleteDriverAccountUsecase], { id: user.sub, dto });
}

@DriverOnly()
@Get('payout/beneficiary')
@ApiOperation({ summary: 'List my saved payout beneficiaries' })
getBeneficiaries(@AuthUser() user: any) {
  return this.payoutService.getBeneficiaries(user.sub);
}

@DriverOnly()
@Get('transactions/wallet')
@ApiOperation({ summary: 'Wallet balance + transaction history (search & date filters)' })
getWalletTransactions(@AuthUser() user: any, @Query() query: WalletTxQueryDto) {
  return this.payoutService.getWalletTransactions(user.sub, query);
}

  @Get('anoucements')
  @ApiOperation({ summary: 'Get all announcements' })
  @ApiResponse({ status: 200, description: 'Announcements fetched successfully' })
  async getAllAnnouncements() {
    return this.notificationService.getAllAnnouncements();
  }

  
@DriverOnly()
@Get('transactions/:id/single')
@ApiOperation({ summary: 'Get a single wallet transaction' })
@ApiParam({ name: 'id', type: String })
getSingleTransaction(@AuthUser() user: any, @Param('id') id: string) {
  return this.payoutService.getSingleTransaction(user.sub, id);
}

  @DriverOnly()
  @Get('get-profile')
  @ApiOperation({ summary: 'Get my driver profile' })
  getProfile(@AuthUser() user: any) {
    return this.broker.runUsecases([this.getDriverProfileUsecase], { id: user.sub });
  }

@DriverOnly()
@Patch('update-profile')
@ApiOperation({ summary: 'Update my profile (name, phone, photo, state)' })
updateProfile(
  @AuthUser() user: any,
  @Body() dto: UpdateDriverProfileDto,
) {
  return this.driverService.updateProfile(user.sub, dto);
}

@DriverOnly()
@Get('trip/status')
@ApiOperation({ summary: 'Get my trips, optionally filtered by trip_type (status)' })
@ApiQuery({ name: 'trip_type', required: false, enum: TripStatus })
getTripStatus(
  @AuthUser() user: any,
  @Query('trip_type') tripType?: string,
) {
  return this.broker.runUsecases([this.getDriverTripStatusUsecase], {
    id: user.sub,
    type: tripType,
  });
}

@DriverOnly()
@Get('dashboard')
@ApiOperation({ summary: 'Driver dashboard (upcoming trips paginated)' })
@ApiQuery({ name: 'page', required: false, type: Number })
@ApiQuery({ name: 'limit', required: false, type: Number })
getDashboard(
  @AuthUser() user: any,
  @Query() query: TripListQueryDto,
) {
  return this.broker.runUsecases([this.getDriverDashboardUsecase], {
    id: user.sub,
    query,
  });
}
  /**
   * ─────────────────────────────────────────────────────────────────────────
   * GET MY TRIPS (PAGINATED)
   * ─────────────────────────────────────────────────────────────────────────
   */
@DriverOnly()
@Get('get-all-vehicle')
@ApiOperation({ summary: 'Get all vehicle types' })
getAll() {
  return this.broker.runUsecases([this.getVehicleTypeUsecase]);
}

  @DriverOnly()
  @Get('trip/getTrip')
  @ApiOperation({
    summary: 'Get all your trips',
    description: 'Retrieve a paginated list of your trips with optional filtering by status.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trips retrieved successfully',
  })

  async getMyTrips(
    @AuthUser() user: any,
    @Query() query: TripListQueryDto,
  ) {
    return this.broker.runUsecases([this.getMyTripUsecase], {id: user.sub, dto: query})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * GET TRIP DETAIL
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Get('trip/:tripId')
  @ApiOperation({
    summary: 'Get trip detail',
    description: 'Get detailed information about a specific trip.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip details retrieved',
    type: DriverTripDetailResponseDto,
  })

  async getTripDetail(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
  ) {
    return this.broker.runUsecases([this.getTripUsecase], {id: user.sub, tripId: tripId})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * UPDATE TRIP (PENDING ONLY)
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Put('trip/update/:tripId')
  @ApiOperation({
    summary: 'Update trip details',
    description: 'Update trip details. Only possible for PENDING trips without confirmed bookings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip updated successfully',
    type: DriverTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot update trip (e.g., has confirmed bookings)',
  })
 
  async updateTrip(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
    @Body() dto: UpdateDriverTripDto,
  ) {
    return this.broker.runUsecases([this.updateDriverTripUsecase], {id: user.sub, tripId: tripId, dto: dto})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * CLOSE / OPEN BOOKINGS
   * ─────────────────────────────────────────────────────────────────────────
   * When bookings are closed, passengers can no longer find the trip in
   * search results, and any direct booking attempt is rejected.
   */
  @DriverOnly()
  @Patch('trip/:tripId/close-booking')
  @ApiOperation({
    summary: 'Close bookings on my trip',
    description:
      'Closes bookings: the trip disappears from passenger search and new bookings are rejected. Trip itself stays active.',
  })
  @ApiParam({ name: 'tripId', type: String })
  async closeBooking(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
  ) {
    return this.broker.runUsecases([this.closeBookingsUsecase], {
      id: user.sub,
      tripId,
      open: false,
    });
  }

  @DriverOnly()
  @Patch('trip/:tripId/open-booking')
  @ApiOperation({
    summary: 'Reopen bookings on my trip',
    description: 'Reopens bookings so passengers can search for and book the trip again.',
  })
  @ApiParam({ name: 'tripId', type: String })
  async openBooking(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
  ) {
    return this.broker.runUsecases([this.closeBookingsUsecase], {
      id: user.sub,
      tripId,
      open: true,
    });
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * ACTIVATE TRIP
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Patch(':tripId/activate')
  @ApiOperation({
    summary: 'Activate trip',
    description: 'Activate (publish) a PENDING trip to accept bookings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip activated successfully',
    type: ActivateTripResponseDto,
  })

  async activateTrip(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
  ) {
     return this.broker.runUsecases([this.activateDriverTripUsecase], {id:user.sub, tripId: tripId})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * CANCEL TRIP
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Delete(':tripId/cancel')
  @ApiOperation({
    summary: 'Cancel trip',
    description:
      'Cancel a PENDING or ACTIVE trip. All confirmed bookings will be refunded automatically.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip cancelled successfully',
    type: CancelTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Trip cannot be cancelled (already completed or cancelled)',
  })

  async cancelTrip(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
    @Body() dto: CancelDriverTripDto,
  ) {
    return this.broker.runUsecases([this.cancleDriverTripUsecase], {id:user.sub, tripId:tripId, dto:dto})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * COMPLETE TRIP
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Patch(':tripId/complete')
  @ApiOperation({
    summary: 'Complete trip',
    description: 'Mark an ACTIVE trip as COMPLETED. This releases all held escrows.',
  })
  @ApiResponse({
    status: 200,
    description: 'Trip completed successfully',
    type: CompleteTripResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Trip is not in ACTIVE status',
  })

  async completeTrip(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
    @Body() dto: CompleteDriverTripDto,
  ){
    return this.broker.runUsecases([this.completeDriverTripUseCase], {id: user.sub, tripId:tripId, dto: dto})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * GET TRIP BOOKINGS
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Get(':tripId/bookings')
  @ApiOperation({
    summary: 'Get trip bookings',
    description: 'Get all bookings for a specific trip.',
  })
  @ApiResponse({
    status: 200,
    description: 'Bookings retrieved successfully',
    type: [DriverBookingResponseDto],
  })

  async getTripBookings(
    @AuthUser() user: any,
    @Param('tripId') tripId: string,
  ) {
    return this.broker.runUsecases([this.getTripBookingsUseCase], {id: user.sub, tripId:tripId})
  }

  /**
   * ─────────────────────────────────────────────────────────────────────────
   * CHECK-IN PASSENGER
   * ─────────────────────────────────────────────────────────────────────────
   */
  @DriverOnly()
  @Post('bookings/:bookingId/check-in')
  @ApiOperation({
    summary: 'Check in passenger',
    description: 'Check in a passenger for a booking.',
  })
  @ApiResponse({
    status: 200,
    description: 'Passenger checked in successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Booking not found',
  })
  async checkInPassenger(
    @AuthUser() user: any,
    @Param('bookingId') bookingId: string,
  ) {
   return this.broker.runUsecases([this.checkInPassengerUsecase], {id: user.sub, bookingId: bookingId})
  }



 
}

// import {
//   Controller,
//   Post,
//   Get,
//   Put,
//   Patch,
//   Delete,
//   Body,
//   Param,
//   Query,
//   UseGuards,
//   HttpCode,
//   HttpStatus,

// } from '@nestjs/common';
// import { ApiTags, ApiParam, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
// import { AuthUser } from '@shared/decorators/authUser.decorator';

// import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';

// import {
//   CreateDriverTripDto,
//   UpdateDriverTripDto,
//   CancelDriverTripDto,
//   CompleteDriverTripDto,
//   CreateTripResponseDto,
//   CancelTripResponseDto,
//   ActivateTripResponseDto,
//   CompleteTripResponseDto,
//   DriverTripResponseDto,
//   DriverTripDetailResponseDto,
//   DriverBookingResponseDto,
// } from '../dtos/create-driver.dto';
// import { Broker } from '@broker/broker';
// import { CreateDriverTripUsecase } from '../usecases/createTrip.usecase';
// import { RolesGuard } from '@shared/guards/roles.guard';
// import { DriverOnly } from '@shared/decorators/roles.decorator';
// import { UpdateDriverTripUsecase } from '../usecases/updateTrip.usecase';
// import { ActivateDriverTripUsecase } from '../usecases/activatetrip.usecase';
// import { CancleDriverTripUsecase } from '../usecases/cancletrip.usecase';
// import { CompleteDriverTripUsecase } from '../usecases/completetrip.usecase';
// import { GetTripBookingsUsecase } from '@modules/trip/usecases/gettripbookings.usecase';
// import { CheckInPassengerUsecase } from '@modules/trip/usecases/checkinpassenger.usecase';
// import { GetTripUsecase } from '@modules/trip/usecases/gettrip.usecase';
// import { GetMyTripUsecase } from '@modules/trip/usecases/getmytrip.usecase';
// import { TripListQueryDto } from '@modules/trip/dtos/trip.dto';
// import { InitiatePayoutDto } from '../dtos/payout.dto';
// import { InitiatePayoutUsecase } from '../usecases/initiatepayout.usecase';
// import { UpdateDriverProfileDto } from '../dtos/updatedriver.dto';
// import { DriverTripService } from '../services/driver.service';
// import { GetVehicleTypeUsecase } from '../usecases/getvehicletype.usecase';
// import { GetDriverTripStatusUsecase } from '../usecases/getdrivertripstatus.usecase';
// import { GetDriverDashboardUsecase } from '../usecases/getdriverdashboard.usecase';
// import { TripStatus } from 'src/types/enums';
// import { GetDriverProfileUsecase } from '../usecases/getdriverprofile.usecase';
// import { PayoutService } from '../services/payout.service';
// import { WalletTxQueryDto } from '../dtos/wallet-query.dto';

// /**
//  * ═══════════════════════════════════════════════════════════════════════════
//  * DRIVER TRIP CONTROLLER
//  * ═══════════════════════════════════════════════════════════════════════════
//  *
//  * Handles all driver-initiated trip operations:
//  * - Create, Update, Activate, Cancel, Complete trips
//  * - Retrieve trip details and bookings
//  */

// @ApiTags('Driver - Trips')
// @ApiBearerAuth()
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Controller('v1/drivers')
// export class DriverTripController {
//   constructor(
//     private readonly broker: Broker,
//     private readonly createDriverTripUsecase: CreateDriverTripUsecase,
//     private readonly updateDriverTripUsecase:UpdateDriverTripUsecase,
//     private readonly activateDriverTripUsecase:ActivateDriverTripUsecase,
//     private readonly cancleDriverTripUsecase:CancleDriverTripUsecase,
//     private readonly completeDriverTripUseCase:CompleteDriverTripUsecase,
//     private readonly getTripBookingsUseCase:GetTripBookingsUsecase,
//     private readonly checkInPassengerUsecase: CheckInPassengerUsecase,
//     private readonly getTripUsecase:GetTripUsecase,
//     private readonly getMyTripUsecase:GetMyTripUsecase,
//     private readonly initiatePayoutUsecase: InitiatePayoutUsecase,
//     private readonly driverService: DriverTripService,
//     private readonly getVehicleTypeUsecase:GetVehicleTypeUsecase,
//     private readonly getDriverTripStatusUsecase: GetDriverTripStatusUsecase,
//     private readonly getDriverDashboardUsecase: GetDriverDashboardUsecase,
//     private readonly getDriverProfileUsecase:GetDriverProfileUsecase,
//     private readonly payoutService: PayoutService,
//   ) {}

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * CREATE TRIP
//    * ─────────────────────────────────────────────────────────────────────────
//    */
// @DriverOnly()
// @Post('trip/create')
// @HttpCode(HttpStatus.CREATED)
// async createTrip(
//   @AuthUser() user: any,
//   @Body() dto: CreateDriverTripDto,
// ): Promise<CreateTripResponseDto> {
//   return this.broker.runUsecases([this.createDriverTripUsecase], {id: user.sub, dto: dto})
 
// }

// @DriverOnly()
// @Post('payout/initiate')
// @ApiOperation({ summary: 'Driver: Request a withdrawal' })
// initiatePayout(@AuthUser() user: any, @Body() dto: InitiatePayoutDto) {
//   return this.broker.runUsecases([this.initiatePayoutUsecase], { id: user.sub, dto });
// }

// @DriverOnly()
// @Get('payout/banks')
// @ApiOperation({ summary: 'Fetch supported bank list' })
// getBanks() {
//   return this.payoutService.getBankList();
// }

// @DriverOnly()
// @Get('payout/beneficiary')
// @ApiOperation({ summary: 'List my saved payout beneficiaries' })
// getBeneficiaries(@AuthUser() user: any) {
//   return this.payoutService.getBeneficiaries(user.sub);
// }

// @DriverOnly()
// @Get('transactions/wallet')
// @ApiOperation({ summary: 'Wallet balance + transaction history (search & date filters)' })
// getWalletTransactions(@AuthUser() user: any, @Query() query: WalletTxQueryDto) {
//   return this.payoutService.getWalletTransactions(user.sub, query);
// }

// @DriverOnly()
// @Get('transactions/:id/single')
// @ApiOperation({ summary: 'Get a single wallet transaction' })
// @ApiParam({ name: 'id', type: String })
// getSingleTransaction(@AuthUser() user: any, @Param('id') id: string) {
//   return this.payoutService.getSingleTransaction(user.sub, id);
// }

//   @DriverOnly()
//   @Get('get-profile')
//   @ApiOperation({ summary: 'Get my driver profile' })
//   getProfile(@AuthUser() user: any) {
//     return this.broker.runUsecases([this.getDriverProfileUsecase], { id: user.sub });
//   }

// @DriverOnly()
// @Patch('update-profile')
// @ApiOperation({ summary: 'Update my profile (name, phone, photo, state)' })
// updateProfile(
//   @AuthUser() user: any,
//   @Body() dto: UpdateDriverProfileDto,
// ) {
//   return this.driverService.updateProfile(user.sub, dto);
// }

// @DriverOnly()
// @Get('trip/status')
// @ApiOperation({ summary: 'Get my trips, optionally filtered by trip_type (status)' })
// @ApiQuery({ name: 'trip_type', required: false, enum: TripStatus })
// getTripStatus(
//   @AuthUser() user: any,
//   @Query('trip_type') tripType?: string,
// ) {
//   return this.broker.runUsecases([this.getDriverTripStatusUsecase], {
//     id: user.sub,
//     type: tripType,
//   });
// }

// @DriverOnly()
// @Get('dashboard')
// @ApiOperation({ summary: 'Driver dashboard (upcoming trips paginated)' })
// @ApiQuery({ name: 'page', required: false, type: Number })
// @ApiQuery({ name: 'limit', required: false, type: Number })
// getDashboard(
//   @AuthUser() user: any,
//   @Query() query: TripListQueryDto,
// ) {
//   return this.broker.runUsecases([this.getDriverDashboardUsecase], {
//     id: user.sub,
//     query,
//   });
// }
//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * GET MY TRIPS (PAGINATED)
//    * ─────────────────────────────────────────────────────────────────────────
//    */
// @DriverOnly()
// @Get('get-all-vehicle')
// @ApiOperation({ summary: 'Get all vehicle types' })
// getAll() {
//   return this.broker.runUsecases([this.getVehicleTypeUsecase]);
// }

//   @DriverOnly()
//   @Get('trip/getTrip')
//   @ApiOperation({
//     summary: 'Get all your trips',
//     description: 'Retrieve a paginated list of your trips with optional filtering by status.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trips retrieved successfully',
//   })

//   async getMyTrips(
//     @AuthUser() user: any,
//     @Query() query: TripListQueryDto,
//   ) {
//     return this.broker.runUsecases([this.getMyTripUsecase], {id: user.sub, dto: query})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * GET TRIP DETAIL
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Get('trip/:tripId')
//   @ApiOperation({
//     summary: 'Get trip detail',
//     description: 'Get detailed information about a specific trip.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trip details retrieved',
//     type: DriverTripDetailResponseDto,
//   })

//   async getTripDetail(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//   ) {
//     return this.broker.runUsecases([this.getTripUsecase], {id: user.sub, tripId: tripId})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * UPDATE TRIP (PENDING ONLY)
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Put('trip/update/:tripId')
//   @ApiOperation({
//     summary: 'Update trip details',
//     description: 'Update trip details. Only possible for PENDING trips without confirmed bookings.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trip updated successfully',
//     type: DriverTripResponseDto,
//   })
//   @ApiResponse({
//     status: 400,
//     description: 'Cannot update trip (e.g., has confirmed bookings)',
//   })
 
//   async updateTrip(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//     @Body() dto: UpdateDriverTripDto,
//   ) {
//     return this.broker.runUsecases([this.updateDriverTripUsecase], {id: user.sub, tripId: tripId, dto: dto})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * ACTIVATE TRIP
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Patch(':tripId/activate')
//   @ApiOperation({
//     summary: 'Activate trip',
//     description: 'Activate (publish) a PENDING trip to accept bookings.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trip activated successfully',
//     type: ActivateTripResponseDto,
//   })

//   async activateTrip(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//   ) {
//      return this.broker.runUsecases([this.activateDriverTripUsecase], {id:user.sub, tripId: tripId})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * CANCEL TRIP
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Delete(':tripId/cancel')
//   @ApiOperation({
//     summary: 'Cancel trip',
//     description:
//       'Cancel a PENDING or ACTIVE trip. All confirmed bookings will be refunded automatically.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trip cancelled successfully',
//     type: CancelTripResponseDto,
//   })
//   @ApiResponse({
//     status: 400,
//     description: 'Trip cannot be cancelled (already completed or cancelled)',
//   })

//   async cancelTrip(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//     @Body() dto: CancelDriverTripDto,
//   ) {
//     return this.broker.runUsecases([this.cancleDriverTripUsecase], {id:user.sub, tripId:tripId, dto:dto})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * COMPLETE TRIP
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Patch(':tripId/complete')
//   @ApiOperation({
//     summary: 'Complete trip',
//     description: 'Mark an ACTIVE trip as COMPLETED. This releases all held escrows.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Trip completed successfully',
//     type: CompleteTripResponseDto,
//   })
//   @ApiResponse({
//     status: 400,
//     description: 'Trip is not in ACTIVE status',
//   })

//   async completeTrip(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//     @Body() dto: CompleteDriverTripDto,
//   ){
//     return this.broker.runUsecases([this.completeDriverTripUseCase], {id: user.sub, tripId:tripId, dto: dto})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * GET TRIP BOOKINGS
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Get(':tripId/bookings')
//   @ApiOperation({
//     summary: 'Get trip bookings',
//     description: 'Get all bookings for a specific trip.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Bookings retrieved successfully',
//     type: [DriverBookingResponseDto],
//   })

//   async getTripBookings(
//     @AuthUser() user: any,
//     @Param('tripId') tripId: string,
//   ) {
//     return this.broker.runUsecases([this.getTripBookingsUseCase], {id: user.sub, tripId:tripId})
//   }

//   /**
//    * ─────────────────────────────────────────────────────────────────────────
//    * CHECK-IN PASSENGER
//    * ─────────────────────────────────────────────────────────────────────────
//    */
//   @DriverOnly()
//   @Post('bookings/:bookingId/check-in')
//   @ApiOperation({
//     summary: 'Check in passenger',
//     description: 'Check in a passenger for a booking.',
//   })
//   @ApiResponse({
//     status: 200,
//     description: 'Passenger checked in successfully',
//   })
//   @ApiResponse({
//     status: 404,
//     description: 'Booking not found',
//   })
//   async checkInPassenger(
//     @AuthUser() user: any,
//     @Param('bookingId') bookingId: string,
//   ) {
//    return this.broker.runUsecases([this.checkInPassengerUsecase], {id: user.sub, bookingId: bookingId})
//   }



 
// }

