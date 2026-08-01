// Geo utilities — pure, dependency-free. Distances in miles.

const EARTH_RADIUS_MI = 3958.8;

/** Haversine distance in miles between two {lat,lng} points. */
export function distanceMi(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(s));
}

/** Filter candidates (each with .location {lat,lng}) to within radiusMi of origin, annotated+sorted by distance. */
export function withinRadius(origin, candidates, radiusMi = 10) {
  return candidates
    .map((c) => ({ ...c, distanceMi: round1(distanceMi(origin, c.location)) }))
    .filter((c) => c.distanceMi <= radiusMi)
    .sort((a, b) => a.distanceMi - b.distanceMi);
}

/** Delivery ETA window in minutes: shopping time + drive time (~2 min/mi urban), clamped 10–60. */
export function etaWindowMin(storeToBuyerMi, itemCount = 3) {
  const shop = 8 + itemCount * 2;
  const drive = Math.ceil(storeToBuyerMi * 2.5);
  const lo = clamp(shop + drive - 5, 10, 60);
  const hi = clamp(shop + drive + 8, lo + 5, 60);
  return { lowMin: lo, highMin: hi };
}

/** Dev/test ZIP centroids (prod uses Google Geocoding, cached in Redis). */
const ZIP_CENTROIDS = {
  95391: { lat: 37.7799, lng: -121.5988 }, // Tracy/Mountain House, CA
  95376: { lat: 37.7397, lng: -121.4252 }, // Tracy, CA
  94103: { lat: 37.7726, lng: -122.4099 },
  10001: { lat: 40.7506, lng: -73.9972 },
};
export function zipToPoint(zip) {
  return ZIP_CENTROIDS[String(zip)] ?? null;
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
export const round1 = (n) => Math.round(n * 10) / 10;
