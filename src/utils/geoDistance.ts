import { RadioStation, StationBoundingBox } from '../types/station';

const EARTH_RADIUS_KM = 6371.0;

/**
 * Validates whether latitude and longitude are valid non-null terrestrial coordinates.
 */
export function isValidCoordinate(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  // Exclude Null Island (0, 0)
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

/**
 * Computes great-circle distance between two geographic coordinates using the Haversine formula.
 * Returns distance in kilometers (km).
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Infinity;
  }

  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }

  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Formats a numeric distance in kilometers into a clean, rounded user-facing string.
 * Examples:
 * - 0.4 km -> "0.4 km away"
 * - 2.41 km -> "2.4 km away"
 * - 18.2 km -> "18 km away"
 * - 46.7 km -> "47 km away"
 */
export function formatDistance(distanceKm: number): string {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || !isFinite(distanceKm)) {
    return 'Distance unavailable';
  }

  if (distanceKm < 0.1) {
    return '< 0.1 km away';
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km away`;
  }

  return `${Math.round(distanceKm)} km away`;
}

/**
 * Computes a geographic bounding box in degrees around a center coordinate and radius in km.
 */
export function calculateBoundingBox(
  centerLat: number,
  centerLng: number,
  radiusKm: number
): StationBoundingBox {
  const kmPerLatDegree = 111.0;
  const latDelta = radiusKm / kmPerLatDegree;

  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const kmPerLngDegree = 111.32 * Math.max(0.01, Math.abs(cosLat));
  const lngDelta = radiusKm / kmPerLngDegree;

  return {
    minLat: Math.max(-90, centerLat - latDelta),
    maxLat: Math.min(90, centerLat + latDelta),
    minLng: Math.max(-180, centerLng - lngDelta),
    maxLng: Math.min(180, centerLng + lngDelta),
  };
}

/**
 * Filters stations within a maximum distance radius and sorts them ascending by distance.
 * Attaches the unrounded `distanceKm` property to each station.
 */
export function filterAndSortStationsByDistance(
  stations: RadioStation[],
  listenerLat: number,
  listenerLng: number,
  maxRadiusKm: number
): RadioStation[] {
  if (!isValidCoordinate(listenerLat, listenerLng)) {
    return [];
  }

  const results: RadioStation[] = [];

  for (const s of stations) {
    if (s.hasCoordinates === false || !isValidCoordinate(s.latitude, s.longitude)) {
      continue;
    }

    const dist = calculateHaversineDistance(listenerLat, listenerLng, s.latitude, s.longitude);
    if (dist <= maxRadiusKm) {
      results.push({
        ...s,
        distanceKm: dist,
      });
    }
  }

  return results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}
