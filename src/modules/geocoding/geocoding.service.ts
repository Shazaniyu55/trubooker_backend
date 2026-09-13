import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { RedisCacheService } from '@modules/cache/redis-cache.service';

export interface GeoPoint {
  lat: number;
  lng: number;
  address: string; // Google's formatted address
}

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — addresses don't move

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly cache: RedisCacheService) {}

  /**
   * Convert an address string to coordinates using the Google Geocoding API.
   * Results are cached in Redis for 30 days (popular terminals repeat across
   * many trips — caching saves quota and latency).
   *
   * NEVER throws — returns null on any failure so trip creation is never
   * blocked by a geocoding hiccup.
   */
  async geocode(rawAddress: string | null | undefined): Promise<GeoPoint | null> {
    const address = rawAddress?.trim();
    if (!address) return null;

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      this.logger.warn('GOOGLE_MAPS_API_KEY not set — skipping geocoding');
      return null;
    }

    const region = process.env.GOOGLE_MAPS_REGION ?? 'ng'; // bias results to Nigeria
    const cacheKey = `geocode:${region}:${address.toLowerCase()}`;

    try {
      return await this.cache.getOrSet<GeoPoint | null>(
        cacheKey,
        async () => {
          const { data } = await axios.get(GEOCODE_URL, {
            params: { address, region, key: apiKey },
            timeout: 10_000,
          });

          if (data.status !== 'OK' || !data.results?.length) {
            this.logger.warn(`Geocoding failed for "${address}": ${data.status}`);
            return null;
          }

          const best = data.results[0];
          return {
            lat: best.geometry.location.lat,
            lng: best.geometry.location.lng,
            address: best.formatted_address,
          };
        },
        CACHE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.error(`Geocoding error for "${address}": ${err.message}`);
      return null;
    }
  }

  /**
   * Geocode a list of mixed entries (strings or objects like
   * { address | name | location, state }). Runs in parallel.
   * Returns one GeoPoint (or null) per entry, same order.
   */
  async geocodeMany(entries: any[] | null | undefined): Promise<(GeoPoint | null)[]> {
    if (!entries?.length) return [];
    return Promise.all(entries.map((e) => this.geocode(this.extractAddress(e))));
  }

  /** Pull a geocodable address string out of a string or loosely-shaped object. */
  extractAddress(entry: any): string | null {
    if (!entry) return null;
    if (typeof entry === 'string') return entry;

    const base = entry.address ?? entry.name ?? entry.location ?? null;
    if (!base) return null;

    // Append state if present and not already in the string — improves accuracy
    if (entry.state && !base.toLowerCase().includes(String(entry.state).toLowerCase())) {
      return `${base}, ${entry.state}`;
    }
    return base;
  }

  async autocomplete(input: string) {
  const q = input?.trim();
  if (!q || q.length < 2) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) { this.logger.warn('GOOGLE_MAPS_API_KEY not set'); return []; }

  const cacheKey = `places:autocomplete:ng:${q.toLowerCase()}`;
  return this.cache.getOrSet(cacheKey, async () => {
    const { data } = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      { params: { input: q, key: apiKey, components: 'country:ng', language: 'en' },
        timeout: 10_000 });

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      this.logger.warn(`Places autocomplete "${q}": ${data.status}`);
      return [];
    }
    return (data.predictions ?? []).map((p) => ({
      placeId: p.place_id,
      description: p.description,                                   // "Wuse 2, Abuja, Nigeria"
      mainText: p.structured_formatting?.main_text ?? p.description, // "Wuse 2"
      secondaryText: p.structured_formatting?.secondary_text ?? '',  // "Abuja, Nigeria"
    }));
  }, 60 * 60 * 24);
}
}