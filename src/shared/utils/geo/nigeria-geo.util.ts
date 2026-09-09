/**
 * Lightweight, dependency-free geography helpers for Nigeria.
 *
 * Two jobs:
 *   1. Work out which state a free-text location string refers to, so we can
 *      tell whether a trip is INTRA-state (within one state) or INTER-state
 *      (crosses a state boundary). This drives how early a matched trip
 *      request is pushed to the driver board (12h vs 18h before departure).
 *   2. Compute a straight-line (haversine) distance between two coordinates,
 *      used by the fare model when geocoding is available.
 *
 * The state resolver is deliberately string-based (no external API) so it can
 * never block trip creation or matching. When it can't decide, callers treat
 * the trip as INTER-state — the safer default, since it gives drivers more
 * lead time.
 */

/** The 36 states + FCT. Order matters only for readability. */
export const NIGERIA_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  'Federal Capital Territory',
] as const;

export type NigeriaState = (typeof NIGERIA_STATES)[number];

/**
 * Common city / landmark → state hints. Not exhaustive; it just covers the
 * busy terminals people actually type ("Wuse", "CMS", "Ikeja"...) that don't
 * literally contain the state name. Extend freely as routes grow.
 */
const CITY_STATE_HINTS: Record<string, NigeriaState> = {
  // FCT
  abuja: 'Federal Capital Territory',
  wuse: 'Federal Capital Territory',
  garki: 'Federal Capital Territory',
  maitama: 'Federal Capital Territory',
  gwarinpa: 'Federal Capital Territory',
  kubwa: 'Federal Capital Territory',
  fct: 'Federal Capital Territory',
  // Lagos
  lagos: 'Lagos',
  ikeja: 'Lagos',
  cms: 'Lagos',
  lekki: 'Lagos',
  yaba: 'Lagos',
  surulere: 'Lagos',
  ajah: 'Lagos',
  oshodi: 'Lagos',
  berger: 'Lagos',
  ojota: 'Lagos',
  // Oyo
  ibadan: 'Oyo',
  // Rivers
  'port harcourt': 'Rivers',
  phc: 'Rivers',
  // Edo
  benin: 'Edo',
  'benin city': 'Edo',
  // Enugu / Anambra / Imo
  enugu: 'Enugu',
  onitsha: 'Anambra',
  awka: 'Anambra',
  owerri: 'Imo',
  // Kano / Kaduna
  kano: 'Kano',
  kaduna: 'Kaduna',
  zaria: 'Kaduna',
  // Others
  jos: 'Plateau',
  abeokuta: 'Ogun',
  'ado ekiti': 'Ekiti',
  akure: 'Ondo',
  osogbo: 'Osun',
  ilorin: 'Kwara',
  uyo: 'Akwa Ibom',
  calabar: 'Cross River',
  warri: 'Delta',
  asaba: 'Delta',
  makurdi: 'Benue',
  lokoja: 'Kogi',
  minna: 'Niger',
  maiduguri: 'Borno',
  yola: 'Adamawa',
  bauchi: 'Bauchi',
  gombe: 'Gombe',
  sokoto: 'Sokoto',
  katsina: 'Katsina',
};


/**
 * Town / district gazetteer. Maps a substring anyone might type inside a free-
 * text address (a town name, an estate, a landmark, a park, a bank branch that
 * carries the town name) to the CANONICAL DISTRICT it belongs to.
 *
 * This is what lets three very different addresses in the same town —
 *   "Emaudo Ekpoma, Edo State"
 *   "GT Bank Ekpoma"
 *   "Market Square, Ekpoma"
 * all collapse to one district: "Ekpoma". Grouping (matching passengers into a
 * single request box) and driver→passenger notification both key off this, so
 * the passenger's house address never matters — only the district does.
 *
 * Keys are matched case-insensitively as substrings, longest-first, so a more
 * specific hint ("benin city") wins over a shorter one ("benin"). Extend freely
 * as new routes/towns come online — this is intentionally just a lookup table
 * so it can never fail or block matching.
 */
const DISTRICT_HINTS: Record<string, string> = {
  // ── Edo State ──────────────────────────────────────────────────────────
  // Benin City and the landmarks/areas people type instead of "Benin City".
  'benin city': 'Benin City',
  benin: 'Benin City',
  'ring road': 'Benin City',
  'oba market': 'Benin City',
  'new benin': 'Benin City',
  uselu: 'Benin City',
  ugbowo: 'Benin City',
  'ramat park': 'Benin City',
  'sapele road': 'Benin City',
  akpakpava: 'Benin City',
  'ugbor': 'Benin City',
  // Ekpoma and its quarters / common landmarks.
  ekpoma: 'Ekpoma',
  emaudo: 'Ekpoma',
  iruekpen: 'Ekpoma',
  ujoelen: 'Ekpoma',
  eguare: 'Ekpoma',
  // Other Edo towns.
  auchi: 'Auchi',
  uromi: 'Uromi',
  ubiaja: 'Ubiaja',
  igarra: 'Igarra',
  irrua: 'Irrua',
  igueben: 'Igueben',
  ehor: 'Ehor',
  abudu: 'Abudu',
  'sabongida ora': 'Sabongida-Ora',
  'sabongida-ora': 'Sabongida-Ora',
};
/**
 * Best-effort resolution of the Nigerian state a location string refers to.
 * Returns null when nothing recognisable is found (caller decides the fallback).
 */
export function resolveNigeriaState(location?: string | null): NigeriaState | null {
  if (!location) return null;
  const text = String(location).toLowerCase();

  // 1) Explicit state name present in the string ("... , Edo, Nigeria").
  //    Check multi-word states first so "Cross River" isn't shadowed by a
  //    stray "river" token elsewhere.
  const byLength = [...NIGERIA_STATES].sort((a, b) => b.length - a.length);
  for (const state of byLength) {
    if (text.includes(state.toLowerCase())) return state;
  }

  // 2) City / landmark hint (longest hint first, same reasoning).
  const hints = Object.keys(CITY_STATE_HINTS).sort((a, b) => b.length - a.length);
  for (const hint of hints) {
    if (text.includes(hint)) return CITY_STATE_HINTS[hint];
  }

  return null;
}

/**
 * Is a trip from `origin` to `destination` inter-state?
 *
 *   - Both endpoints resolve to the SAME state  → false (intra-state).
 *   - Both resolve to DIFFERENT states           → true  (inter-state).
 *   - Either endpoint can't be resolved          → true  (safe default:
 *     treat as inter-state so drivers get the longer 18h lead time).
 */
export function isInterStateTrip(origin?: string | null, destination?: string | null): boolean {
  const o = resolveNigeriaState(origin);
  const d = resolveNigeriaState(destination);
  if (!o || !d) return true;
  return o !== d;
}

/** Straight-line distance between two lat/lng points, in kilometres. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371; // earth radius km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}


/**
 * Best-effort resolution of the town/district a free-text location refers to.
 * Returns a canonical district label (e.g. "Ekpoma", "Benin City") or null when
 * nothing recognisable is found. Falls back to the city hints used for state
 * resolution so major cities (Ikeja, Lekki, Wuse…) also resolve to a district.
 */
export function resolveNigeriaDistrict(location?: string | null): string | null {
  if (!location) return null;
  const text = String(location).toLowerCase();

  // 1) Known town / landmark, most specific first.
  const districtHints = Object.keys(DISTRICT_HINTS).sort(
    (a, b) => b.length - a.length,
  );
  for (const hint of districtHints) {
    if (text.includes(hint)) return DISTRICT_HINTS[hint];
  }

  // 2) Fall back to the city hints (they double as districts for big cities).
  const cityHints = Object.keys(CITY_STATE_HINTS).sort(
    (a, b) => b.length - a.length,
  );
  for (const hint of cityHints) {
    if (text.includes(hint)) return titleCase(hint);
  }

  return null;
}

/** Strip a string down to a stable lowercase alphanumeric token. */
function toToken(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function titleCase(value: string): string {
  return String(value ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * The token used to GROUP locations by district. Prefers the resolved district;
 * when the town isn't in the gazetteer it falls back to the whole string with
 * the state name and filler words removed (so "…, Edo State" and "…, Edo" agree)
 * rather than just the first comma-segment. Two addresses in the same known town
 * always return the same token; unknown towns degrade gracefully.
 */
export function districtToken(location?: string | null): string {
  const district = resolveNigeriaDistrict(location);
  if (district) return toToken(district);

  // Fallback: drop any state name and filler, then tokenise what's left.
  let text = String(location ?? '').toLowerCase();
  for (const state of NIGERIA_STATES) {
    text = text.split(state.toLowerCase()).join(' ');
  }
  text = text.replace(/\bstate\b|\bnigeria\b/g, ' ');
  return toToken(text);
}
