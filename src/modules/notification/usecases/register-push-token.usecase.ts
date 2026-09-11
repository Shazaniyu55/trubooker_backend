import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { NotificationService } from '../services/notification.service';

@Injectable()
export class RegisterPushTokenUseCase {
  constructor(private readonly notificationService: NotificationService) {}

  async execute(_entityManager: EntityManager, arg: { id: string; expoToken: string }) {
    return this.notificationService.registerPushToken(arg.id, arg.expoToken);
  }
}