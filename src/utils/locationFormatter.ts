/**
 * fmX Robust Location Formatter
 * Formats station location strings accurately without repeating country names,
 * without inventing cities, and clearly marking unverified locations.
 */

export interface StationLocationInput {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  countryCode?: string | null;
  hasCoordinates?: boolean;
  isLocationVerified?: boolean;
}

export function formatStationLocation(station: StationLocationInput | null | undefined): string {
  if (!station) {
    return 'Location unverified';
  }

  const rawCountry = (station.country || '').trim();
  const rawState = (station.state || '').trim();
  const rawCity = (station.city || '').trim();

  // If country is missing or generic unverified placeholder
  if (
    !rawCountry ||
    rawCountry.toLowerCase() === 'global' ||
    rawCountry.toLowerCase() === 'unknown' ||
    rawCountry.toLowerCase() === 'gl'
  ) {
    if (rawCity && rawCity.toLowerCase() !== 'global' && rawCity.toLowerCase() !== 'unknown') {
      return rawCity;
    }
    return 'Location unverified';
  }

  const countryLower = rawCountry.toLowerCase();

  // Clean state: omit if it matches country
  const cleanState =
    rawState && rawState.toLowerCase() !== countryLower ? rawState : '';

  // Clean city: omit if it matches country or state
  const stateLower = cleanState.toLowerCase();
  const cleanCity =
    rawCity &&
    rawCity.toLowerCase() !== countryLower &&
    rawCity.toLowerCase() !== stateLower
      ? rawCity
      : '';

  // Case 1: Both city and state are known and distinct
  if (cleanCity && cleanState) {
    return `${cleanCity}, ${cleanState}, ${rawCountry}`;
  }

  // Case 2: Only city is known
  if (cleanCity) {
    return `${cleanCity}, ${rawCountry}`;
  }

  // Case 3: Only state is known (e.g. Tamil Nadu, India)
  if (cleanState) {
    return `${cleanState}, ${rawCountry}`;
  }

  // Case 4: Only country is known (e.g. Mirchi Love with no city/state metadata)
  return rawCountry;
}
