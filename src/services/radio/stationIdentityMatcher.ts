import { RadioStation } from '../../types/station';

export type IdentityMatchVerdict =
  | 'EXACT_SAME_PROVIDER_ID'
  | 'CONFIRMED_CROSS_PROVIDER'
  | 'SUPPORTING_STREAM_MATCH'
  | 'CONFLICT_DIFFERENT_BROADCASTER'
  | 'DISTINCT_STATION';

export interface StationIdentityComparison {
  verdict: IdentityMatchVerdict;
  isSameStation: boolean;
  confidence: number;
  reasons: string[];
  conflictWarning?: string;
}

/**
 * Normalizes website domains for canonical comparison (e.g., 'https://www.kexp.org/listen' -> 'kexp.org')
 */
export function normalizeWebsiteDomain(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url.startsWith('http') ? url : `http://${url}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Normalizes stream URLs removing protocols, trailing slashes, and common query noise.
 */
export function normalizeStreamEndpoint(url?: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '')
    .split('?')[0];
}

/**
 * Normalizes broadcaster name for conservative fuzzy comparison.
 */
export function normalizeStationTitle(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(fm|am|radio|online|live|stream|web)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Conservative Station Identity Matcher.
 * Disentangles stations with similar names across different cities/countries.
 * Never merges different broadcasters merely because their names or genres sound similar.
 */
export function compareStationIdentity(
  a: RadioStation,
  b: RadioStation
): StationIdentityComparison {
  const reasons: string[] = [];

  // 1. Same provider + same provider ID -> Absolute exact match
  if (a.provider && b.provider && a.provider === b.provider) {
    const idA = a.sourceStationId || a.id;
    const idB = b.sourceStationId || b.id;
    if (idA === idB) {
      return {
        verdict: 'EXACT_SAME_PROVIDER_ID',
        isSameStation: true,
        confidence: 1.0,
        reasons: [`Identical ${a.provider} directory ID: ${idA}`],
      };
    }
  }

  // 2. Conflict Check: Different Country -> NEVER the same station
  const countryA = (a.countryCode || '').toUpperCase();
  const countryB = (b.countryCode || '').toUpperCase();
  if (countryA && countryB && countryA !== countryB) {
    const conflict = `Country divergence: "${a.name}" (${countryA}) vs "${b.name}" (${countryB})`;
    return {
      verdict: 'CONFLICT_DIFFERENT_BROADCASTER',
      isSameStation: false,
      confidence: 0.0,
      reasons: ['Stations belong to distinct countries / sovereign territories'],
      conflictWarning: conflict,
    };
  }

  // 3. Conflict Check: Same Name, but distinct verified cities / states
  const cityA = (a.city || '').toLowerCase().trim();
  const cityB = (b.city || '').toLowerCase().trim();
  if (cityA && cityB && cityA !== cityB) {
    // E.g., 'Radio City' in Mumbai vs 'Radio City' in Bangalore or London
    const normNameA = normalizeStationTitle(a.name);
    const normNameB = normalizeStationTitle(b.name);
    if (normNameA === normNameB) {
      const conflict = `Local broadcaster collision: "${a.name}" broadcasts in ${a.city}, whereas "${b.name}" is in ${b.city}`;
      return {
        verdict: 'CONFLICT_DIFFERENT_BROADCASTER',
        isSameStation: false,
        confidence: 0.1,
        reasons: ['Distinct city locations despite identical station brand name'],
        conflictWarning: conflict,
      };
    }
  }

  // 4. Official Website corroboration
  const domainA = normalizeWebsiteDomain(a.homepage);
  const domainB = normalizeWebsiteDomain(b.homepage);
  const hasMatchingDomain = domainA && domainB && domainA === domainB;

  if (hasMatchingDomain) {
    reasons.push(`Matching official web domain: ${domainA}`);
  }

  // 5. Stream URL Comparison (supporting evidence, not standalone proof)
  const normStreamA = normalizeStreamEndpoint(a.streamUrl || a.urlResolved);
  const normStreamB = normalizeStreamEndpoint(b.streamUrl || b.urlResolved);
  const hasMatchingStream = normStreamA && normStreamB && normStreamA === normStreamB;

  if (hasMatchingStream) {
    reasons.push('Identical normalized audio stream endpoint');
  }

  // 6. Name Similarity
  const cleanNameA = normalizeStationTitle(a.name);
  const cleanNameB = normalizeStationTitle(b.name);
  const isNameIdentical = cleanNameA && cleanNameB && cleanNameA === cleanNameB;

  // Decision logic:
  // Both official domain and station name match -> Confirmed cross-provider identity
  if (hasMatchingDomain && (isNameIdentical || hasMatchingStream)) {
    return {
      verdict: 'CONFIRMED_CROSS_PROVIDER',
      isSameStation: true,
      confidence: 0.95,
      reasons: [...reasons, 'Corroborating web domain, broadcaster title, and stream evidence'],
    };
  }

  // Stream matches and name matches within same country/city
  if (hasMatchingStream && isNameIdentical) {
    return {
      verdict: 'SUPPORTING_STREAM_MATCH',
      isSameStation: true,
      confidence: 0.85,
      reasons: [...reasons, 'Matching stream endpoint and matching station title within same territory'],
    };
  }

  // If only stream matches, but names completely diverge (e.g. multi-tenant relay), do NOT merge
  if (hasMatchingStream && !isNameIdentical) {
    return {
      verdict: 'CONFLICT_DIFFERENT_BROADCASTER',
      isSameStation: false,
      confidence: 0.3,
      reasons: ['Shared relay CDN stream without corroborating station title'],
      conflictWarning: `Shared stream endpoint between differing titles: "${a.name}" and "${b.name}"`,
    };
  }

  return {
    verdict: 'DISTINCT_STATION',
    isSameStation: false,
    confidence: 0.0,
    reasons: ['No corroborating provider ID, official domain, or stream evidence'],
  };
}
