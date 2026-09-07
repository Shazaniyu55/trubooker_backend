// src/modules/notification/notification.module.ts
import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Broker } from '@broker/broker';
import { NotificationRepository } from '@adapters/repositories/notification.repository';
import { NotificationController } from './controllers/notification.controller';
import { NotificationService } from './services/notification.service';
import { ExpoService } from './services/expo.service';
import { NotificationGateway } from './gateway/notification.gateway';
import { CreateNotificationUseCase } from './usecases/create-notification.usecase';
import { SendPushNotificationUseCase } from './usecases/send-push-notification.usecase';
import { Notification } from '@modules/core/entities/notification.entity';
import { User } from '@modules/core/entities/user.entity';
import { Admin } from '@modules/core/entities/admin.entity';
import { GetUnReadNotificationUseCase } from './usecases/getunread.usecase';
import { GetAllNotificationUseCase } from './usecases/getallnotify.usecase';
import { MarkAllNotificationUseCase } from './usecases/markallread.usecase';
import { DelteNotificationUseCase } from './usecases/deletenotify.usecase';
import { MarkOneNotificationUseCase } from './usecases/markoneread.usecase';
import { DeleteOneNotificationUseCase } from './usecases/deleteonenotify.usecase';
import { CloudinaryModule } from '@modules/cloudinary/cloudinary.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Admin, Notification, User]),
    CloudinaryModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cs: ConfigService) => ({
        secret: cs.get<string>('common.auth.jwt.accessSecret'),
        signOptions: { expiresIn: cs.get<string>('common.auth.jwt.accessExpiresIn') },
      }),
    }),
  ],
  controllers: [NotificationController],
  providers: [
    Broker,
    NotificationRepository,
    NotificationService,
    ExpoService,
    NotificationGateway,
    CreateNotificationUseCase,
    SendPushNotificationUseCase,
    GetUnReadNotificationUseCase,
    GetAllNotificationUseCase,
    MarkAllNotificationUseCase,
    DelteNotificationUseCase,
    MarkOneNotificationUseCase,
    DeleteOneNotificationUseCase
  ],
  exports: [NotificationService, NotificationGateway, ExpoService],
})
export class NotificationModule {}