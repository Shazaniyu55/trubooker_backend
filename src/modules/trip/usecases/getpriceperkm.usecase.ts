import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Usecase } from '@broker/types';
import { FareService } from '../service/fare.service';
import { PricePerKmQueryDto } from '../dtos/trip.dto';

/**
 * Plain "price per km" lookup: real driving distance between origin and
 * destination via Google's Distance Matrix API, the current admin-configured
 * rate per km, and the resulting estimated total (distance × rate). No
 * seats/min-max band — just the raw distance + rate for a route.
 */
@Injectable()
export class GetPricePerKmUsecase extends Usecase {
  constructor(private readonly fareService: FareService) {
    super();
  }

  async execute(_em: EntityManager, args: PricePerKmQueryDto) {
    return this.fareService.getPricePerKm(args.origin, args.destination);
  }
}