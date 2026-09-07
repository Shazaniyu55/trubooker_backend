import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { Broker } from '@broker/broker';

import { TripRequest } from '@modules/core/entities/trip-request.entity';
import { TripRequestPool } from '@modules/core/entities/trip-request-pool.entity';
import { Driver } from '@modules/core/entities/driver.entity';
import { Trip } from '@modules/core/entities/trip.entity';

import { TripMatchingService } from './service/trip-matching.service';
import { MatchingTasksService } from './service/matching-tasks.service';
import { TripMatchingController } from './controller/trip-matching.controller';

import { GetDriverBoardUsecase } from './usecases/getdriverboard.usecase';
import { ClaimPoolUsecase } from './usecases/claimpool.usecase';
import { RunMatchingUsecase } from './usecases/runmatching.usecase';
import { User } from '@modules/core/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    // NotificationService comes from the @Global() NotificationModule.
    TypeOrmModule.forFeature([TripRequest, TripRequestPool, Driver, Trip, User]),
  ],
  controllers: [TripMatchingController],
  providers: [
    Broker,
    TripMatchingService,
    MatchingTasksService,
    GetDriverBoardUsecase,
    ClaimPoolUsecase,
    RunMatchingUsecase,
  ],
  exports: [TripMatchingService],
})
export class TripMatchingModule {}
