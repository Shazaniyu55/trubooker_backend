import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip } from '@modules/core/entities/trip.entity';
import { GeocodingService } from '@modules/geocoding/geocoding.service';
import { SystemSettingService } from '@modules/system/service/system.service';
import { PriceControlDto } from 'src/types/enums';
import {
  haversineKm,
  isInterStateTrip,
  resolveNigeriaState,
} from '@shared/utils/geo/nigeria-geo.util';

/**
 * Fare model — deliberately simple (ride-sharing / cost-split):
 *
 *     total trip cost   = distance (km) × rate per km
 *     price per seat    = total trip cost ÷ seats
 *
 * The total is the cost of running the whole trip; passengers SPLIT it, so the
 * more people share, the less each pays. The rate per km DIFFERS by trip type
 * — inter-state and intra-state are priced independently (admin-configurable
 * via price control → interStatePerKmRate / intraStatePerKmRate). When the
 * admin hasn't set one yet we fall back to the defaults below. If we can't
 * work out the distance (geocoding unavailable), there is no estimate.
 */
const DEFAULT_INTER_STATE_PER_KM_RATE = 200; // NGN/km, cross-state, until admin sets one
const DEFAULT_INTRA_STATE_PER_KM_RATE = 315; // NGN/km, same-state, until admin sets one

export interface RouteEstimate {
  originState: string | null;
  destinationState: string | null;
  isInterState: boolean;
  distanceKm: number | null; // null when geocoding was unavailable
}

// export interface PriceRecommendation extends RouteEstimate {
//   currency: 'NGN';
//   perKmRate: number;
//   recommendedPricePerSeat: number | null; // null when distance unavailable
//   basis: 'distance' | 'unavailable';
// }

export interface PriceRecommendation extends RouteEstimate {
  currency: 'NGN';
  perKmRate: number;
  recommendedPricePerSeat: number | null; // null when distance unavailable
  basis: 'distance' | 'unavailable';
  /** Seat count the maximum total is based on (the vehicle's capacity). */
  maxSeats: number;
  /** Total for a single seat — the LOWEST the trip can cost. */
  minTotal: number | null;
  /** Total with every seat filled — the HIGHEST the trip can cost. */
  maxTotal: number | null;
  /**
   * What the driver app labels "total trip cost": the MAXIMUM (all seats).
   * Alias of maxTotal so the app can bind to one unambiguous field and never
   * show the single-seat minimum by mistake.
   */
  totalTripCost: number | null;
}

export interface PassengerFareEstimate {
  seats: number;
  pricePerSeat: number;
  total: number;
}

@Injectable()
export class FareService {
  private readonly logger = new Logger(FareService.name);

  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    private readonly geocoding: GeocodingService,
    private readonly systemSettings: SystemSettingService,
  ) {}

  // ── Config ──────────────────────────────────────────────────────────────

  /**
   * The admin's rate per km for this trip type, or the default when none is
   * configured. Inter-state and intra-state are priced independently — this
   * is the fix for "price per km should differ by trip type" — so callers
   * must always know isInterState before pricing anything.
   */
  private async perKmRate(isInterState: boolean): Promise<number> {
    let settings: Partial<PriceControlDto> = {};
    try {
      settings = (await this.systemSettings.getPriceControl()) ?? {};
    } catch {
      // No price-control row yet — fall back to the default silently.
    }
    const rate = isInterState ? settings.interStatePerKmRate : settings.intraStatePerKmRate;
    const fallback = isInterState
      ? DEFAULT_INTER_STATE_PER_KM_RATE
      : DEFAULT_INTRA_STATE_PER_KM_RATE;
    return num(rate, fallback);
  }

  // ── Route shape (states + distance) ───────────────────────────────────────

  async estimateRoute(origin: string, destination: string): Promise<RouteEstimate> {
  const originState = resolveNigeriaState(origin);
  const destinationState = resolveNigeriaState(destination);
  const isInterState = isInterStateTrip(origin, destination);

  let distanceKm: number | null = null;

  try {
    // Prefer real driving distance
    const driving = await this.geocoding.getDrivingDistance(origin, destination);
    if (driving) {
      distanceKm = driving.distanceKm;
    } else {
      // Fall back to straight-line distance if Distance Matrix is unavailable
      const [a, b] = await this.geocoding.geocodeMany([origin, destination]);
      if (a && b) {
        distanceKm = round(haversineKm(a.lat, a.lng, b.lat, b.lng), 1);
        this.logger.warn(
          `Falling back to haversine distance for "${origin}" → "${destination}"`,
        );
      }
    }
  } catch (err) {
    this.logger.warn(
      `Route distance lookup failed for "${origin}" → "${destination}": ${err?.message}`,
    );
  }

  return { originState, destinationState, isInterState, distanceKm };
}

  // ── Plain distance + price-per-km (Google Distance Matrix) ───────────────

  /**
   * Lean route pricing: just the Google-derived driving distance, the current
   * per-km rate, and distance × rate. No seats/band logic — for callers that
   * only want "how far, and how much per km".
   */
  async getPricePerKm(
    origin: string,
    destination: string,
  ): Promise<{
    origin: string;
    destination: string;
    isInterState: boolean;
    distanceKm: number | null;
    durationMinutes: number | null;
    currency: 'NGN';
    perKmRate: number;
    estimatedTotal: number | null;
  }> {
    const isInterState = isInterStateTrip(origin, destination);
    const perKmRate = await this.perKmRate(isInterState);

    let distanceKm: number | null = null;
    let durationMinutes: number | null = null;
    try {
      const driving = await this.geocoding.getDrivingDistance(origin, destination);
      if (driving) {
        distanceKm = driving.distanceKm;
        durationMinutes = driving.durationMinutes;
      } else {
        const [a, b] = await this.geocoding.geocodeMany([origin, destination]);
        if (a && b) {
          distanceKm = round(haversineKm(a.lat, a.lng, b.lat, b.lng), 1);
          this.logger.warn(
            `price-per-km: falling back to haversine for "${origin}" → "${destination}"`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `price-per-km: distance lookup failed for "${origin}" → "${destination}": ${err?.message}`,
      );
    }

    const estimatedTotal =
      distanceKm != null ? roundToNearest(distanceKm * perKmRate, 100) : null;

    return {
      origin,
      destination,
      isInterState,
      distanceKm,
      durationMinutes,
      currency: 'NGN',
      perKmRate,
      estimatedTotal,
    };
  }

 

  // ── The recommendation: distance × rate per km ────────────────────────────

   async recommendPrice(
    origin: string,
    destination: string,
    maxSeats = 4,
  ): Promise<PriceRecommendation> {
    const route = await this.estimateRoute(origin, destination);
    const perKmRate = await this.perKmRate(route.isInterState);

    let recommendedPricePerSeat: number | null = null;
    let basis: PriceRecommendation['basis'] = 'unavailable';

    const cap = clamp(Math.floor(maxSeats), 1, 50);

    let totalTripCost: number | null = null;
    if (route.distanceKm != null) {
      // The WHOLE ride: 205 km × ₦200/km = ₦41,000. Fixed — it does NOT grow
      // with the number of seats.
      totalTripCost = roundToNearest(route.distanceKm * perKmRate, 100);

      // Ride-sharing: split the total across the seats so each extra passenger
      // lowers everyone's share. Recommended per-seat assumes a full vehicle
      // (the cheapest per person): ₦41,000 ÷ 4 = ₦10,250.
      recommendedPricePerSeat = roundToNearest(totalTripCost / cap, 100);
      basis = 'distance';
    }

    // Per-seat range by how many actually share the ride:
    //   • full vehicle → total ÷ capacity  (lowest per seat)
    //   • 1 passenger  → the whole total    (highest per seat)
    const minTotal = recommendedPricePerSeat; // all seats filled (cheapest share)
    const maxTotal = totalTripCost;           // only one seat taken (whole ride)

    return {
      ...route,
      currency: 'NGN',
      perKmRate,
      recommendedPricePerSeat,
      basis,
      maxSeats: cap,
      minTotal,
      maxTotal,
      totalTripCost,
    };
  }

  // ── Passenger-facing estimate for 1–N seats ───────────────────────────────





async estimateForPassengers(
  origin: string,
  destination: string,
  maxSeats = 4,
): Promise<{
  recommendation: PriceRecommendation;
  perSeat: number | null;
  seats: PassengerFareEstimate[];
  maxSeats: number;
  minTotal: number | null;
  maxTotal: number | null;
  totalTripCost: number | null;
}> {
  const cap = clamp(Math.floor(maxSeats), 1, 10);
  const recommendation = await this.recommendPrice(origin, destination, cap);
  const total = recommendation.totalTripCost;

  // Cost-split table: with `s` passengers sharing the same ride, each pays
  // total ÷ s. More riders ⇒ cheaper per seat.
  //   1 rider → ₦41,000   2 → ₦20,500   4 → ₦10,250
  const seats: PassengerFareEstimate[] =
    total == null
      ? []
      : Array.from({ length: cap }, (_, i) => {
          const s = i + 1;
          const pricePerSeat = roundToNearest(total / s, 100);
          return { seats: s, pricePerSeat, total }; // total collected stays the ride cost
        });

  const perSeat = recommendation.recommendedPricePerSeat; // full-vehicle share

  return {
    recommendation,
    perSeat,
    seats,
    maxSeats: cap,
    minTotal: perSeat,    // full vehicle: cheapest per-seat share
    maxTotal: total,      // one rider: pays the whole trip
    totalTripCost: total, // fixed ride cost the app splits
  };
}

}

// ── small helpers ─────────────────────────────────────────────────────────────
function num(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function round(v: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}
function roundToNearest(v: number, step: number): number {
  return Math.max(step, Math.round(v / step) * step);
}









