import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Usecase } from '@broker/types';
import { FareService } from '../service/fare.service';
import { PriceRecommendationQueryDto } from '../dtos/trip.dto';

/**
 * Driver-facing: recommend a fair per-seat price for a route, plus the
 * acceptable min/max band the driver may price within. Prevents exaggeration
 * while still letting the driver choose a price around the recommendation.
 */
@Injectable()
export class RecommendTripPriceUsecase extends Usecase {
  constructor(private readonly fareService: FareService) {
    super();
  }

  async execute(_em: EntityManager, args: PriceRecommendationQueryDto) {
    return this.fareService.recommendPrice(
      args.origin,
      args.destination,
      args.seats ?? 4,
    );
  }
}
