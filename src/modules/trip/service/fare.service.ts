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
 * Fare model — deliberately simple:
 *
 *     estimated price = distance (km) × rate per km
 *
 * The rate per km is set by the admin (price control → perKmRate). When the
 * admin hasn't set one yet we fall back to DEFAULT_PER_KM_RATE. If we can't
 * work out the distance (geocoding unavailable), there is no estimate.
 */
const DEFAULT_PER_KM_RATE = 200; // NGN per km, used only until admin sets one

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

  /** The admin's rate per km, or the default when none is configured. */
  private async perKmRate(): Promise<number> {
    let settings: Partial<PriceControlDto> = {};
    try {
      settings = (await this.systemSettings.getPriceControl()) ?? {};
    } catch {
      // No price-control row yet — fall back to the default silently.
    }
    return num(settings.perKmRate, DEFAULT_PER_KM_RATE);
  }

  // ── Route shape (states + distance) ───────────────────────────────────────

  async estimateRoute(origin: string, destination: string): Promise<RouteEstimate> {
    const originState = resolveNigeriaState(origin);
    const destinationState = resolveNigeriaState(destination);
    const isInterState = isInterStateTrip(origin, destination);

    let distanceKm: number | null = null;
    try {
      const [a, b] = await this.geocoding.geocodeMany([origin, destination]);
      if (a && b) {
        distanceKm = round(haversineKm(a.lat, a.lng, b.lat, b.lng), 1);
      }
    } catch (err) {
      this.logger.warn(
        `Route geocoding failed for "${origin}" → "${destination}": ${err?.message}`,
      );
    }

    return { originState, destinationState, isInterState, distanceKm };
  }

  // ── The recommendation: distance × rate per km ────────────────────────────

   async recommendPrice(
    origin: string,
    destination: string,
    maxSeats = 4,
  ): Promise<PriceRecommendation> {
    const perKmRate = await this.perKmRate();
    const route = await this.estimateRoute(origin, destination);

    let recommendedPricePerSeat: number | null = null;
    let basis: PriceRecommendation['basis'] = 'unavailable';

    if (route.distanceKm != null) {
      // e.g. 10 km × ₦200/km = ₦2,000
      recommendedPricePerSeat = roundToNearest(route.distanceKm * perKmRate, 100);
      basis = 'distance';
    }

    // Total trip cost = price per seat × seats. The MAX (every seat filled) is
    // what the driver's "total trip cost" should display; the MIN is a single
    // seat. Pass the real vehicle capacity as `maxSeats` for the true maximum.
    const cap = clamp(Math.floor(maxSeats), 1, 50);
    const minTotal =
      recommendedPricePerSeat == null ? null : recommendedPricePerSeat;
    const maxTotal =
      recommendedPricePerSeat == null ? null : recommendedPricePerSeat * cap;

    return {
      ...route,
      currency: 'NGN',
      perKmRate,
      recommendedPricePerSeat,
      basis,
      maxSeats: cap,
      minTotal,
      maxTotal,
      totalTripCost: maxTotal,
    };
  }

  // ── Passenger-facing estimate for 1–N seats ───────────────────────────────



// async estimateForPassengers(
//   origin: string,
//   destination: string,
//   maxSeats = 4,
// ): Promise<{
//   recommendation: PriceRecommendation;
//   perSeat: number | null;
//   seats: PassengerFareEstimate[];
//   maxSeats: number;
//   maxTotal: number | null;
// }> {
//   const recommendation = await this.recommendPrice(origin, destination);
//   const perSeat = recommendation.recommendedPricePerSeat;
//   const cap = clamp(Math.floor(maxSeats), 1, 10);

//   const seats: PassengerFareEstimate[] =
//     perSeat == null
//       ? []
//       : Array.from({ length: cap }, (_, i) => {
//           const s = i + 1;
//           return { seats: s, pricePerSeat: perSeat, total: perSeat * s };
//         });

//   return {
//     recommendation,
//     perSeat,
//     seats,
//     maxSeats: cap,
//     maxTotal: perSeat == null ? null : perSeat * cap,
//   };
// }

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
  const perSeat = recommendation.recommendedPricePerSeat;

  const seats: PassengerFareEstimate[] =
    perSeat == null
      ? []
      : Array.from({ length: cap }, (_, i) => {
          const s = i + 1;
          return { seats: s, pricePerSeat: perSeat, total: perSeat * s };
        });

  const maxTotal = perSeat == null ? null : perSeat * cap;

  return {
    recommendation,
    perSeat,
    seats,
    maxSeats: cap,
    minTotal: perSeat == null ? null : perSeat, // single-seat (lowest) total
    maxTotal, // all-seats (highest) total
    totalTripCost: maxTotal, // what the app shows as "total trip cost"
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