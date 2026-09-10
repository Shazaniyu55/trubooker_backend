import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { User } from './entities/user.entity';
import { Driver } from './entities/driver.entity';
import { Passenger } from './entities/passenger.entity';
import { Agent } from './entities/agent.entity';
import { Vehicle } from './entities/vehicle.entity';
import { Trip } from './entities/trip.entity';
import { Booking } from './entities/booking.entity';
import { Notification } from './entities/notification.entity';
import { DocumentVerification } from './entities/document-verification.entity';
import { Payout } from './entities/payout.entity';
import { Coupon } from './entities/coupon.entity';
import { ContactSupport } from './entities/contact-support.entity';
import { Review } from './entities/review.entity';
import { TripLocation } from './entities/triplocation.entity';
import { SearchHistory } from './entities/searchhistory.entity';
import { Admin } from './entities/admin.entity';
import { AuditLog } from './entities/auditlog.entity';
import { AgentCommission } from './entities/agent-commission.entity';
import { Beneficiary } from './entities/beneficiary.entity';
import { Escrow } from './entities/escro.entity';
import { KillSwitch } from './entities/kill-switch.entity';
import { Payment } from './entities/payment.entity';
import { Permission } from './entities/permission.entity';
import { Referral } from './entities/referal.entity';
import { ReferralConfig } from './entities/referalconfig.entity';
import { Role } from './entities/role.entity';
import { AppVersionHistory } from './entities/appversion.entity';
import { AgentReferral } from './entities/agent-referral.entity';
import { SystemSetting } from './entities/system-setting.entity';
import { SystemRecord } from './entities/system-record.entity';
import { BookingIntent } from './entities/booking_intent.entity';
import { Lga } from './entities/lga.entity';
import { State } from './entities/state.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Admin,
      User,
      Driver,
      Passenger,
      Agent,
      Vehicle,
      Trip,
      Booking,
      Notification,
      DocumentVerification,
      ContactSupport,
      Payout,
      Coupon,
      Review,
      TripLocation,
      SearchHistory,
      AuditLog,
      AgentCommission ,
      Beneficiary,
      Escrow,
      KillSwitch,
      Payment,
      Permission,
      BookingIntent,
      Referral,
      ReferralConfig,
      Role,
      AppVersionHistory,
      AgentReferral,
      SystemSetting,
      SystemRecord,
      State,
      Lga
    ]),
  ],
  providers: [],
  exports: [],
})
export class CoreModule {}
