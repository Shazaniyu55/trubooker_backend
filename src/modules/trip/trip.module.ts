import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Trip } from '@modules/core/entities/trip.entity';
import { Booking } from '@modules/core/entities/booking.entity';
import { Driver } from '@modules/core/entities/driver.entity';
import { Passenger } from '@modules/core/entities/passenger.entity';
import { Coupon } from '@modules/core/entities/coupon.entity';
import { Notification } from '@modules/core/entities/notification.entity';
import { Vehicle } from '@modules/core/entities/vehicle.entity';

import { PaymentFactory } from '@adapters/payment/payment.factory';
import { PaystackAdapter } from '@adapters/payment/paystack/paystack.adapter';
import { PaystackProvider } from '@adapters/payment/paystack/providers/paystack.provider';
import { FlutterwaveAdapter } from '@adapters/payment/flutterwave/flutterwave.adapter';
import { FlutterwaveProvider } from '@adapters/payment/flutterwave/providers/flutterwave.provider';
import { RandomnessUtil } from '@shared/utils/encryption/randomness.util';
import { ExpoService } from '@modules/notification/services/expo.service';
import { Broker } from '@broker/broker';
import { Escrow } from '@modules/core/entities/escro.entity';
import { TripsController } from './controllers/trip.controller';
import { TripsService } from './service/trip.service';
import { TripRepository } from '@adapters/repositories/trip.repository';
import { CreateTripUsecase } from './usecases/createtrip.usecase';
import { SearchTripUsecase } from './usecases/searchtrip.usecase';
import { GetTripUsecase } from './usecases/gettrip.usecase';
import { ActivateTripUsecase } from './usecases/activatetrip.usecase';
import { UpdateTripUsecase } from './usecases/updatetrip.usecase';
import { CompleteTripUsecase } from './usecases/completetrip.usecase';
import { CancleTripUsecase } from './usecases/cancletrip.usecase';
import { GetMyTripUsecase } from './usecases/getmytrip.usecase';
import { GetMyBookingsUsecase } from './usecases/getmybooking.usecase';
import { GetTripBookingsUsecase } from './usecases/gettripbookings.usecase';
import { CheckInPassengerUsecase } from './usecases/checkinpassenger.usecase';
import { CancleBookingUsecase } from './usecases/canclebooking.usecase';
import { GetBookingCodeUsecase } from './usecases/getbookingcode.usecase';
import { BookTripUsecase } from './usecases/booktrip.usecase';
import { ScanTicketUsecase } from './usecases/scanticket.usecase';
import { GetBoardingQrUsecase } from './usecases/getboardingqr.usecase';
import { SearchTripStateUsecase } from './usecases/searchtripstate.usecase';
import { VerifyBookingUsecase } from './usecases/verifybooking.usecase';
import { CloseBookingsUsecase } from './usecases/closebookings.usecase';
import { StartTripUsecase } from './usecases/starttrip.usecase';
import { GetTripChartSummaryUsecase } from './usecases/gettripchartsummary.usecase';
import { GetTripActivityUsecase } from './usecases/gettripactivity.usecase';
import { GetCancellationReasonsUsecase } from './usecases/getcancelreason.usecase';
import { BookingIntent } from '@modules/core/entities/booking_intent.entity';
import { Review } from '@modules/core/entities/review.entity';
import { VehicleType } from '@modules/core/entities/vehicletype.entity';
import { GetTripSummaryByIdUsecase } from './usecases/gettripsummarybyid.usecase';
import { SearchTripAlterUsecase } from './usecases/Searchtripalter.usecase';
import { FareService } from './service/fare.service';
import { RecommendTripPriceUsecase } from './usecases/recommendtripprice.usecase';
import { EstimateFareUsecase } from './usecases/estimatefare.usecase';
import { SystemSettingModule } from '@modules/system/system.module';
import { TripMatchingModule } from '@modules/trip-matching/trip-matching.module';



@Module({
  imports: [
    ConfigModule,
    SystemSettingModule,
    TripMatchingModule,
    TypeOrmModule.forFeature([
      Trip,
      Booking,
      Driver,
      Passenger,
      Escrow,
      Coupon,
      Notification,
      Vehicle,
      BookingIntent,
      Review,
      VehicleType
    ]),
  ],
  controllers: [TripsController],
  providers: [
    Broker,
    TripsService,
    PaymentFactory,
    PaystackAdapter,
    PaystackProvider,
    FlutterwaveAdapter,
    TripRepository,
    FlutterwaveProvider,
    RandomnessUtil,
    ExpoService,

    CreateTripUsecase,
    SearchTripUsecase,
    GetCancellationReasonsUsecase,
    GetTripSummaryByIdUsecase,
    GetTripUsecase,
    ActivateTripUsecase,
    ScanTicketUsecase,
    UpdateTripUsecase,
    CompleteTripUsecase,
    CancleTripUsecase,
    GetMyTripUsecase,
    GetMyBookingsUsecase,
    GetTripBookingsUsecase,
    CheckInPassengerUsecase,
    CancleBookingUsecase,
    GetBookingCodeUsecase,
    GetBoardingQrUsecase,
    SearchTripStateUsecase,
    BookTripUsecase,
    VerifyBookingUsecase,
    CloseBookingsUsecase,
    StartTripUsecase,
    GetTripChartSummaryUsecase,
    GetTripActivityUsecase,
    SearchTripAlterUsecase,
    FareService,
    RecommendTripPriceUsecase,
    EstimateFareUsecase,
  ],
  exports: [TripsService, TripRepository, FareService],
})
export class TripsModule {}



// import { Module } from '@nestjs/common';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { ConfigModule } from '@nestjs/config';

// import { Trip } from '@modules/core/entities/trip.entity';
// import { Booking } from '@modules/core/entities/booking.entity';
// import { Driver } from '@modules/core/entities/driver.entity';
// import { Passenger } from '@modules/core/entities/passenger.entity';
// import { Coupon } from '@modules/core/entities/coupon.entity';
// import { Notification } from '@modules/core/entities/notification.entity';
// import { Vehicle } from '@modules/core/entities/vehicle.entity';

// import { PaymentFactory } from '@adapters/payment/payment.factory';
// import { PaystackAdapter } from '@adapters/payment/paystack/paystack.adapter';
// import { PaystackProvider } from '@adapters/payment/paystack/providers/paystack.provider';
// import { FlutterwaveAdapter } from '@adapters/payment/flutterwave/flutterwave.adapter';
// import { FlutterwaveProvider } from '@adapters/payment/flutterwave/providers/flutterwave.provider';
// import { RandomnessUtil } from '@shared/utils/encryption/randomness.util';
// import { ExpoService } from '@modules/notification/services/expo.service';
// import { Broker } from '@broker/broker';
// import { Escrow } from '@modules/core/entities/escro.entity';
// import { TripsController } from './controllers/trip.controller';
// import { TripsService } from './service/trip.service';
// import { TripRepository } from '@adapters/repositories/trip.repository';
// import { CreateTripUsecase } from './usecases/createtrip.usecase';
// import { SearchTripUsecase } from './usecases/searchtrip.usecase';
// import { GetTripUsecase } from './usecases/gettrip.usecase';
// import { ActivateTripUsecase } from './usecases/activatetrip.usecase';
// import { UpdateTripUsecase } from './usecases/updatetrip.usecase';
// import { CompleteTripUsecase } from './usecases/completetrip.usecase';
// import { CancleTripUsecase } from './usecases/cancletrip.usecase';
// import { GetMyTripUsecase } from './usecases/getmytrip.usecase';
// import { GetMyBookingsUsecase } from './usecases/getmybooking.usecase';
// import { GetTripBookingsUsecase } from './usecases/gettripbookings.usecase';
// import { CheckInPassengerUsecase } from './usecases/checkinpassenger.usecase';
// import { CancleBookingUsecase } from './usecases/canclebooking.usecase';
// import { GetBookingCodeUsecase } from './usecases/getbookingcode.usecase';
// import { BookTripUsecase } from './usecases/booktrip.usecase';
// import { ScanTicketUsecase } from './usecases/scanticket.usecase';
// import { GetBoardingQrUsecase } from './usecases/getboardingqr.usecase';
// import { SearchTripStateUsecase } from './usecases/searchtripstate.usecase';
// import { VerifyBookingUsecase } from './usecases/verifybooking.usecase';
// import { CloseBookingsUsecase } from './usecases/closebookings.usecase';
// import { StartTripUsecase } from './usecases/starttrip.usecase';
// import { GetTripChartSummaryUsecase } from './usecases/gettripchartsummary.usecase';
// import { GetTripActivityUsecase } from './usecases/gettripactivity.usecase';
// import { GetCancellationReasonsUsecase } from './usecases/getcancelreason.usecase';
// import { BookingIntent } from '@modules/core/entities/booking_intent.entity';
// import { Review } from '@modules/core/entities/review.entity';
// import { VehicleType } from '@modules/core/entities/vehicletype.entity';
// import { GetTripSummaryByIdUsecase } from './usecases/gettripsummarybyid.usecase';
// import { SearchTripAlterUsecase } from './usecases/Searchtripalter.usecase';



// @Module({
//   imports: [
//     ConfigModule,
//     TypeOrmModule.forFeature([
//       Trip,
//       Booking,
//       Driver,
//       Passenger,
//       Escrow,
//       Coupon,
//       Notification,
//       Vehicle,
//       BookingIntent,
//       Review,
//       VehicleType
//     ]),
//   ],
//   controllers: [TripsController],
//   providers: [
//     Broker,
//     TripsService,
//     PaymentFactory,
//     PaystackAdapter,
//     PaystackProvider,
//     FlutterwaveAdapter,
//     TripRepository,
//     FlutterwaveProvider,
//     RandomnessUtil,
//     ExpoService,

//     CreateTripUsecase,
//     SearchTripUsecase,
//     GetCancellationReasonsUsecase,
//     GetTripSummaryByIdUsecase,
//     GetTripUsecase,
//     ActivateTripUsecase,
//     ScanTicketUsecase,
//     UpdateTripUsecase,
//     CompleteTripUsecase,
//     CancleTripUsecase,
//     GetMyTripUsecase,
//     GetMyBookingsUsecase,
//     GetTripBookingsUsecase,
//     CheckInPassengerUsecase,
//     CancleBookingUsecase,
//     GetBookingCodeUsecase,
//     GetBoardingQrUsecase,
//     SearchTripStateUsecase,
//     BookTripUsecase,
//     VerifyBookingUsecase,
//     CloseBookingsUsecase,
//     StartTripUsecase,
//     GetTripChartSummaryUsecase,
//     GetTripActivityUsecase,
//     SearchTripAlterUsecase
//   ],
//   exports: [TripsService, TripRepository],
// })
// export class TripsModule {}

