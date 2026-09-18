import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Usecase } from '@broker/types';
import { DriverTripService } from '../services/driver.service';
import { DeleteUserDto } from '@modules/auth/dtos/deleteuser.dto';

@Injectable()
export class DeleteDriverAccountUsecase extends Usecase {
  constructor(private readonly driverService: DriverTripService) {
    super();
  }

  async execute(entityManager: EntityManager, args: { id: string; dto: DeleteUserDto }) {
    const user = await this.driverService.deleteAccount(args.id, args.dto, entityManager);
    return { user };
  }
}