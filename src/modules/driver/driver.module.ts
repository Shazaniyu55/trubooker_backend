import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { Trip } from '@modules/core/entities/trip.entity';
import { Driver } from '@modules/core/entities/driver.entity';
import { Booking } from '@modules/core/entities/booking.entity';
import { Passenger } from '@modules/core/entities/passenger.entity';
import { Escrow } from '@modules/core/entities/escro.entity';
import { Coupon } from '@modules/core/entities/coupon.entity';
import { Notification } from '@modules/core/entities/notification.entity';
import { Vehicle } from '@modules/core/entities/vehicle.entity';

// Controllers


// Use Cases


// Shared Dependencies
import { RandomnessUtil } from '@shared/utils/encryption/randomness.util';
import { PaymentFactory } from '@adapters/payment/payment.factory';
import { ExpoService } from '@modules/notification/services/expo.service';
import { DriverTripController } from './controllers/driver.controller';
import { DriverTripService } from './services/driver.service';
import { TripsService } from '@modules/trip/service/trip.service';
import { PaystackAdapter } from '@adapters/payment/paystack/paystack.adapter';
import { FlutterwaveProvider } from '@adapters/payment/flutterwave/providers/flutterwave.provider';
import { PaystackProvider } from '@adapters/payment/paystack/providers/paystack.provider';
import { FlutterwaveAdapter } from '@adapters/payment/flutterwave/flutterwave.adapter';
import { Broker } from '@broker/broker';
import { TripsModule } from '@modules/trip/trip.module';
import { CreateDriverTripUsecase } from './usecases/createTrip.usecase';
import { UpdateDriverTripUsecase } from './usecases/updateTrip.usecase';
import { ActivateDriverTripUsecase } from './usecases/activatetrip.usecase';
import { CancleDriverTripUsecase } from './usecases/cancletrip.usecase';
import { CompleteDriverTripUsecase } from './usecases/completetrip.usecase';
import { GetTripBookingsUsecase } from '@modules/trip/usecases/gettripbookings.usecase';
import { CheckInPassengerUsecase } from '@modules/trip/usecases/checkinpassenger.usecase';
import { GetTripUsecase } from '@modules/trip/usecases/gettrip.usecase';
import { GetMyTripUsecase } from '@modules/trip/usecases/getmytrip.usecase';
import { CloseBookingsUsecase } from '@modules/trip/usecases/closebookings.usecase';
import { NotificationModule } from '@modules/notification/notification.module';
import { Payout } from '@modules/core/entities/payout.entity';
import { Agent } from '@modules/core/entities/agent.entity';
import { Beneficiary } from '@modules/core/entities/beneficiary.entity';
import { PayoutService } from './services/payout.service';
import { InitiatePayoutUsecase } from './usecases/initiatepayout.usecase';
import { CloudinaryModule } from '@modules/cloudinary/cloudinary.module';
import { DriverRepository } from '@adapters/repositories/driver.repository';
import { User } from '@modules/core/entities/user.entity';
import { VehicleType } from '@modules/core/entities/vehicletype.entity';
import { GetVehicleTypeUsecase } from './usecases/getvehicletype.usecase';
import { GetDriverTripStatusUsecase } from './usecases/getdrivertripstatus.usecase';
import { GetDriverDashboardUsecase } from './usecases/getdriverdashboard.usecase';
import { GetDriverProfileUsecase } from './usecases/getdriverprofile.usecase';
import { TripMatchingModule } from '@modules/trip-matching/trip-matching.module';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DRIVER TRIP MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Orchestrates driver trip management features:
 * - Create, update, activate, cancel, complete trips
 * - Trip bookings and passenger management
 * - Escrow and payment handling
 */

@Module({
  imports: [
    CloudinaryModule,
    ConfigModule,
    TripsModule,
    NotificationModule,
    TripMatchingModule,
    TypeOrmModule.forFeature([
      Trip,
      Driver,
      Booking,
      Passenger,
      User,
      VehicleType,
      Escrow,
      Coupon,
      Notification,
      Vehicle,
      Payout,
      Agent,
      Beneficiary
    ]),
  ],
  controllers: [DriverTripController],
  providers: [
    Broker,
    DriverRepository,
    // Services
    DriverTripService,
    //TripsService,
    PayoutService,
    // Use Cases
    CreateDriverTripUsecase,
    InitiatePayoutUsecase,
    UpdateDriverTripUsecase,
    ActivateDriverTripUsecase,
    CancleDriverTripUsecase,
    CompleteDriverTripUsecase,
    GetTripBookingsUsecase,
    CheckInPassengerUsecase,
    GetDriverTripStatusUsecase,
    GetDriverDashboardUsecase,
    GetDriverProfileUsecase,
    GetTripUsecase,
    GetMyTripUsecase,
    GetVehicleTypeUsecase,
    CloseBookingsUsecase,


    // Shared Dependencies
    RandomnessUtil,
    PaymentFactory,
    ExpoService,
    PaystackAdapter,
    PaystackProvider,
    FlutterwaveAdapter,
    FlutterwaveProvider,


  ],
  exports: [DriverTripService, TripsModule, PayoutService],
})
export class DriverModule {}
