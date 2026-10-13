/**
 * fmX Geographic Region & Language Classification
 * Maps ISO 3166-1 alpha-2 country codes to continents/regions.
 * Strictly avoids using station name keywords to determine region.
 */

export type ContinentRegion =
  | 'ASIA'
  | 'EUROPE'
  | 'AFRICA'
  | 'NORTH_AMERICA'
  | 'SOUTH_AMERICA'
  | 'OCEANIA'
  | 'OTHER';

const ASIA_COUNTRY_CODES = new Set([
  'IN', 'JP', 'CN', 'KR', 'SG', 'TH', 'VN', 'ID', 'PH', 'MY',
  'LK', 'PK', 'BD', 'NP', 'MM', 'KH', 'LA', 'MN', 'TW', 'HK',
  'MO', 'AE', 'SA', 'QA', 'KW', 'OM', 'BH', 'IL', 'JO', 'LB',
  'TR', 'IQ', 'IR', 'AF', 'UZ', 'KZ', 'GE', 'AZ', 'AM', 'SY',
  'YE', 'MV', 'BT', 'BN', 'TL', 'TJ', 'KG', 'TM', 'CY', 'PS'
]);

const EUROPE_COUNTRY_CODES = new Set([
  'GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'CH', 'BE', 'AT', 'SE',
  'NO', 'DK', 'FI', 'IE', 'PT', 'GR', 'PL', 'CZ', 'HU', 'RO',
  'BG', 'HR', 'RS', 'SK', 'SI', 'EE', 'LV', 'LT', 'UA', 'IS',
  'LU', 'MT', 'AL', 'BA', 'ME', 'MK', 'MD', 'BY', 'AD', 'MC',
  'SM', 'VA', 'LI'
]);

const AFRICA_COUNTRY_CODES = new Set([
  'ZA', 'EG', 'NG', 'KE', 'GH', 'MA', 'TN', 'DZ', 'ET', 'TZ',
  'UG', 'SN', 'CI', 'CM', 'ZW', 'ZM', 'AO', 'MZ', 'NA', 'BW',
  'MU', 'MG', 'RW', 'SD', 'SO', 'CD', 'CG', 'GA', 'ML', 'BF',
  'NE', 'TD', 'SL', 'LR', 'TG', 'BJ', 'LY', 'MR', 'SC'
]);

const NORTH_AMERICA_COUNTRY_CODES = new Set([
  'US', 'CA', 'MX', 'CU', 'DO', 'PR', 'JM', 'HT', 'PA', 'CR',
  'GT', 'HN', 'SV', 'NI', 'BS', 'BB', 'TT'
]);

const SOUTH_AMERICA_COUNTRY_CODES = new Set([
  'BR', 'AR', 'CL', 'CO', 'PE', 'VE', 'UY', 'EC', 'BO', 'PY',
  'GY', 'SR'
]);

const OCEANIA_COUNTRY_CODES = new Set([
  'AU', 'NZ', 'FJ', 'PG', 'WS', 'TO', 'VU', 'SB', 'GU'
]);

/**
 * Returns the geographic continent region strictly derived from a valid ISO-3166-1 country code.
 */
export function getRegionForCountryCode(countryCode: string | null | undefined): ContinentRegion {
  if (!countryCode) return 'OTHER';
  const code = countryCode.trim().toUpperCase();

  if (ASIA_COUNTRY_CODES.has(code)) return 'ASIA';
  if (EUROPE_COUNTRY_CODES.has(code)) return 'EUROPE';
  if (AFRICA_COUNTRY_CODES.has(code)) return 'AFRICA';
  if (NORTH_AMERICA_COUNTRY_CODES.has(code)) return 'NORTH_AMERICA';
  if (SOUTH_AMERICA_COUNTRY_CODES.has(code)) return 'SOUTH_AMERICA';
  if (OCEANIA_COUNTRY_CODES.has(code)) return 'OCEANIA';

  return 'OTHER';
}

/**
 * Checks whether a station belongs to a specified region based on its country code.
 * Does NOT classify a station into a region based on its name.
 */
export function isStationInRegion(
  station: { countryCode?: string; country?: string },
  region: ContinentRegion
): boolean {
  const code = (station.countryCode || '').trim().toUpperCase();
  return getRegionForCountryCode(code) === region;
}

/**
 * Checks whether a station broadcasts in Tamil based on metadata language and tags.
 * A Tamil-language station can broadcast from India, Sri Lanka, Malaysia, Singapore, USA, Canada, UK, etc.
 */
export function isTamilLanguageStation(station: {
  language?: string;
  languages?: string[];
  languageCodes?: string[];
  tags?: string[];
  genres?: string[];
}): boolean {
  if (station.language && /tamil/i.test(station.language)) return true;
  if (station.languages && station.languages.some((l) => /tamil/i.test(l))) return true;
  if (station.languageCodes && station.languageCodes.includes('ta')) return true;
  if (station.genres && station.genres.some((g) => /tamil/i.test(g))) return true;
  return false;
}

/**
 * Checks whether a station is physically located in India.
 */
export function isStationInIndia(station: { countryCode?: string; country?: string }): boolean {
  const code = (station.countryCode || '').trim().toUpperCase();
  if (code === 'IN') return true;
  const country = (station.country || '').trim().toLowerCase();
  return country === 'india';
}
