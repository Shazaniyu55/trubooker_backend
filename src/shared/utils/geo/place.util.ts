import {
  NIGERIA_STATES,
  NigeriaState,
  resolveSpecificDistrict,
} from './nigeria-geo.util';

/**
 * A location reduced to the three things trip matching cares about.
 *
 *   state — canonical state name ("Delta", "Federal Capital Territory")
 *   lga   — the Local Government Area (Nigeria's official "district"),
 *           normalised ("ika south")
 *   city  — the city / town, normalised ("agbor", "benin")
 *
 * Any of them can be null when Google could not tell (or, for `city`, when it
 * is as coarse as the state itself — "Lagos" says nothing about WHICH part of
 * Lagos, so the LGA has to decide).
 */
export interface ResolvedPlace {
  state: NigeriaState | null;
  lga: string | null;
  city: string | null;
}

export interface GoogleAddressComponent {
  long_name: string;
  short_name?: string;
  types: string[];
}

export interface GoogleGeocodeResult {
  address_components?: GoogleAddressComponent[];
}

/** Lower-case, no accents/punctuation, LGA/city boilerplate removed. */
export function normalizePlaceName(raw?: string | null): string | null {
  let s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  s = s.replace(/\(.*?\)/g, ' ');
  s = s.replace(/\blocal government area\b|\blocal government\b|\bl\.g\.a\b|\blga\b/g, ' ');
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();
  s = s.replace(/\s+(city|town)$/, ''); // "benin city" → "benin"
  return s || null;
}

/** "Delta State" / "FCT" / "Abuja" / "Federal Capital Territory" → canonical state. */
export function canonicalState(raw?: string | null): NigeriaState | null {
  let s = String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z ]+/g, ' ')
    .replace(/\bstate\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return null;
  if (['fct', 'abuja', 'abuja fct', 'federal capital territory', 'abuja federal capital territory'].includes(s)) {
    return 'Federal Capital Territory';
  }
  return NIGERIA_STATES.find((st) => st.toLowerCase() === s) ?? null;
}

/**
 * City key. Runs the gazetteer first so a landmark Google reports as a
 * "locality" ("Ugbowo") collapses to its town ("Benin City" → "benin").
 */
function cityKey(rawCity: string | null | undefined, state: NigeriaState | null): string | null {
  if (!rawCity) return null;
  const gaz = resolveSpecificDistrict(rawCity);
  const key = normalizePlaceName(gaz ?? rawCity);
  if (!key) return null;
  // As coarse as the state ("Lagos" in Lagos) → useless for telling districts apart.
  if (state && key === normalizePlaceName(state)) return null;
  return key;
}

/**
 * Build a place from Google Geocoding `results`.
 *   mergeAll = true  (reverse geocode) — results run most → least specific, so
 *              take each field from the first result that has it.
 *   mergeAll = false (forward geocode) — only the best match; later results
 *              are different places.
 */
export function placeFromGoogleResults(
  results: GoogleGeocodeResult[] | null | undefined,
  mergeAll: boolean,
): ResolvedPlace | null {
  if (!results?.length) return null;
  const pool = mergeAll ? results : results.slice(0, 1);

  let rawState: string | null = null;
  let rawLga: string | null = null;
  let rawCity: string | null = null;

  for (const r of pool) {
    for (const c of r.address_components ?? []) {
      const types = c.types ?? [];
      if (!rawState && types.includes('administrative_area_level_1')) rawState = c.long_name;
      else if (!rawLga && types.includes('administrative_area_level_2')) rawLga = c.long_name;
      else if (!rawCity && types.includes('locality')) rawCity = c.long_name;
    }
  }

  const state = canonicalState(rawState);
  const place: ResolvedPlace = {
    state,
    lga: normalizePlaceName(rawLga),
    city: cityKey(rawCity, state),
  };
  return place.state || place.lga || place.city ? place : null;
}

/** True when the place can say something about WHICH town/district (not just the state). */
export function hasDistrictInfo(p?: Partial<ResolvedPlace> | null): boolean {
  return !!(p && (p.city || p.lga));
}

/**
 * Do two places share a departure town/district?
 *   true  — same city, or same LGA (district)
 *   false — different states, or both a city AND an LGA are known on both sides
 *           and neither matches
 *   null  — not enough information to say; the caller falls back to comparing
 *           the address text
 */
export function compareDeparture(
  a?: Partial<ResolvedPlace> | null,
  b?: Partial<ResolvedPlace> | null,
): boolean | null {
  if (!a || !b) return null;
  if (a.state && b.state && a.state !== b.state) return false;

  const cityEq = a.city && b.city ? a.city === b.city : null;
  const lgaEq = a.lga && b.lga ? a.lga === b.lga : null;

  if (cityEq === true || lgaEq === true) return true;
  if (cityEq === false && lgaEq === false) return false;
  return null;
}

// Nigeria's bounding box — used to tell [lat, lng] from [lng, lat].
const inNigeria = (lat: number, lng: number) =>
  lat >= 4.2 && lat <= 13.9 && lng >= 2.6 && lng <= 14.7;

/**
 * Read a coordinate out of whatever the app sent in `departureLatlong`:
 * [lat, lng], [lng, lat], [{lat, lng}], [{latitude, longitude}], [{lat, long}],
 * or a bare object. Returns null unless the point falls inside Nigeria, so a
 * swapped/garbage value can never send us to the wrong place.
 */
export function extractLatLng(value: any): { lat: number; lng: number } | null {
  const num = (v: any) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  };

  const fromObject = (o: any) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const lat = num(o.lat ?? o.latitude);
    const lng = num(o.lng ?? o.long ?? o.lon ?? o.longitude);
    return lat !== null && lng !== null ? { lat, lng } : null;
  };

  const candidates: { lat: number; lng: number }[] = [];
  const first = Array.isArray(value) ? value[0] : value;

  const direct = fromObject(value) ?? fromObject(first);
  if (direct) candidates.push(direct);

  const pair = Array.isArray(value) && value.length >= 2 ? value : Array.isArray(first) ? first : null;
  if (pair && pair.length >= 2) {
    const a = num(pair[0]);
    const b = num(pair[1]);
    if (a !== null && b !== null) {
      candidates.push({ lat: a, lng: b }); // [lat, lng]
      candidates.push({ lat: b, lng: a }); // [lng, lat]
    }
  }

  return candidates.find((c) => inNigeria(c.lat, c.lng)) ?? null;
}

/** The subset of a Trip / TripRequest row used for matching. */
export function placeFromColumns(
  state?: string | null,
  lga?: string | null,
  city?: string | null,
): ResolvedPlace {
  return { state: canonicalState(state), lga: lga ?? null, city: city ?? null };
}

/**
 * SQL twin of compareDeparture, for filtering `trips` rows in a search.
 * `place` is the passenger's searched origin; the columns are the trip's
 * departureState / departureLga / departureCity.
 *
 *   accept — same city or same LGA (and not a different state)
 *   reject — different state, or a city AND an LGA both known on both sides
 *            and neither matches
 * Rows that are neither accepted nor rejected are undecided (the trip was
 * never resolved, or too little is known) — the caller then falls back to
 * matching the address text. Returns null when `place` says nothing at all.
 *
 * Named params are prefixed with `p` so several filters can share a query.
 */
export function departureGeoSql(
  place: Partial<ResolvedPlace> | null | undefined,
  p: string,
): { accept: string; reject: string; params: Record<string, string> } | null {
  if (!place || !(place.state || place.city || place.lga)) return null;

  const params: Record<string, string> = {};
  const matchParts: string[] = [];
  if (place.city) {
    matchParts.push(`trip.departureCity = :${p}City`);
    params[`${p}City`] = place.city;
  }
  if (place.lga) {
    matchParts.push(`trip.departureLga = :${p}Lga`);
    params[`${p}Lga`] = place.lga;
  }

  let stateOk = 'TRUE';
  const rejectParts: string[] = [];
  if (place.state) {
    params[`${p}State`] = place.state;
    stateOk = `(trip.departureState IS NULL OR trip.departureState = :${p}State)`;
    rejectParts.push(`(trip.departureState IS NOT NULL AND trip.departureState <> :${p}State)`);
  }
  if (place.city && place.lga) {
    rejectParts.push(
      `(trip.departureCity IS NOT NULL AND trip.departureLga IS NOT NULL ` +
        `AND trip.departureCity <> :${p}City AND trip.departureLga <> :${p}Lga)`,
    );
  }

  return {
    accept: matchParts.length ? `(${stateOk} AND (${matchParts.join(' OR ')}))` : 'FALSE',
    reject: rejectParts.length ? `(${rejectParts.join(' OR ')})` : 'FALSE',
    params,
  };
}