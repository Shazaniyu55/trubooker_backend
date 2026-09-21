import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';

import { TripRequestRepository } from '@adapters/repositories/trip-request.repository';
import { TripMatchingService } from '@modules/trip-matching/service/trip-matching.service';
import {
  ApproveTripRequestDto,
  CreateTripRequestDto,
  DeclineTripRequestDto,
  TripRequestListQueryDto,
} from '../dtos/trip-request.dto';
import { GeocodingService } from '@modules/geocoding/geocoding.service';

@Injectable()
export class TripRequestService {
  private readonly logger = new Logger(TripRequestService.name);

  constructor(
    private readonly repo: TripRequestRepository,
    private readonly matching: TripMatchingService,
        private readonly geocoding: GeocodingService,
  ) {}

  // ── Passenger ──────────────────────────────────────────────────────────
  async createRequest(userId: string, dto: CreateTripRequestDto, em?: EntityManager) {
     const originPlace = await this.geocoding
      .resolvePlace({ address: dto.origin })
      .catch(() => null);

    const saved = await this.repo.createRequest(userId, dto, em, originPlace);

    // Pool the request automatically, in the same transaction, the moment it's
    // created — no admin approval, no waiting for the next matching cron tick.
    // Best-effort: a matching hiccup must never fail the passenger's request
    // (the cron sweep will pick it up on the next pass as a safety net).
    if (em) {
      try {
        await this.matching.matchRequestNow(saved.id, em);
      } catch (err) {
        this.logger.warn(
          `Auto-pooling failed for trip request ${saved.id}: ${err?.message}`,
        );
      }
    }

    return saved;
  }

  getMyRequests(userId: string, query: TripRequestListQueryDto) {
    return this.repo.getMyRequests(userId, query);
  }

  // ── Admin ──────────────────────────────────────────────────────────────
  listRequests(query: TripRequestListQueryDto) {
    return this.repo.listRequests(query);
  }

  getRequestById(id: string) {
    return this.repo.getRequestById(id);
  }

  approveRequest(adminId: string, id: string, dto: ApproveTripRequestDto, em?: EntityManager) {
    return this.repo.approveRequest(adminId, id, dto, em);
  }

  declineRequest(adminId: string, id: string, dto: DeclineTripRequestDto, em?: EntityManager) {
    return this.repo.declineRequest(adminId, id, dto, em);
  }
}

// import { Injectable } from '@nestjs/common';
// import { EntityManager } from 'typeorm';

// import { TripRequestRepository } from '@adapters/repositories/trip-request.repository';
// import {
//   ApproveTripRequestDto,
//   CreateTripRequestDto,
//   DeclineTripRequestDto,
//   TripRequestListQueryDto,
// } from '../dtos/trip-request.dto';

// @Injectable()
// export class TripRequestService {
//   constructor(private readonly repo: TripRequestRepository) {}

//   // ── Passenger ──────────────────────────────────────────────────────────
//   createRequest(userId: string, dto: CreateTripRequestDto, em?: EntityManager) {
//     return this.repo.createRequest(userId, dto, em);
//   }

//   getMyRequests(userId: string, query: TripRequestListQueryDto) {
//     return this.repo.getMyRequests(userId, query);
//   }

//   // ── Admin ──────────────────────────────────────────────────────────────
//   listRequests(query: TripRequestListQueryDto) {
//     return this.repo.listRequests(query);
//   }

//   getRequestById(id: string) {
//     return this.repo.getRequestById(id);
//   }

//   approveRequest(adminId: string, id: string, dto: ApproveTripRequestDto, em?: EntityManager) {
//     return this.repo.approveRequest(adminId, id, dto, em);
//   }

//   declineRequest(adminId: string, id: string, dto: DeclineTripRequestDto, em?: EntityManager) {
//     return this.repo.declineRequest(adminId, id, dto, em);
//   }
// }