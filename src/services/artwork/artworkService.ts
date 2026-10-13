import AsyncStorage from '@react-native-async-storage/async-storage';
import { RadioStation, StationArtwork, ArtworkSourceType } from '../../types/station';

/**
 * Authoritative broadcaster official artwork directory.
 * Maps exact, verified station IDs (and source IDs) to their official broadcaster artwork.
 * Strict UUID-to-artwork mapping prevents cross-pollution between sibling/regional services.
 */
export const VERIFIED_BROADCASTER_ARTWORK: Record<string, { url: string; attribution: string }> = {
  // Prasar Bharati / All India Radio Chennai Services
  '68d00a44-200c-4c82-b17f-18d777f3b2ee': {
    url: 'https://prasarbharati.gov.in/wp-content/themes/prasarbharati/images/air_logo.png',
    attribution: 'Prasar Bharati / All India Radio',
  },
  '952e65fc-55dc-4e1b-83bb-c43afff0bc9c': {
    url: 'https://prasarbharati.gov.in/wp-content/themes/prasarbharati/images/air_rainbow.png',
    attribution: 'AIR FM Rainbow Chennai',
  },
  // 89.4 Tamil FM Dubai
  'e75a90d7-b812-49f2-a6be-a3585977ee12': {
    url: 'https://894tamilfm.com/wp-content/uploads/2021/04/logo.png',
    attribution: '89.4 Tamil FM Dubai',
  },
  // BBC World Service (both canonical verified catalogue ID and Radio Browser directory UUID)
  'a347209e-6ce6-4c94-81ed-003c1275188f': {
    url: 'https://cdn-profiles.tunein.com/s24948/images/logoq.jpg?t=1',
    attribution: 'BBC World Service London',
  },
  'e8f967be-165b-4303-a8c6-35a4d468eb37': {
    url: 'https://cdn-profiles.tunein.com/s24948/images/logoq.jpg?t=1',
    attribution: 'BBC World Service London',
  },
  // KEXP 90.3 FM Seattle (both canonical verified catalogue ID and Radio Browser directory UUID)
  '399ca326-0f67-4015-a51b-d7ba2bd4ebbe': {
    url: 'https://icecast.walmradio.com:8443/jazz.jpg',
    attribution: 'KEXP 90.3 FM Seattle',
  },
  '96041c64-0601-11e8-ae97-52543be04c81': {
    url: 'https://icecast.walmradio.com:8443/jazz.jpg',
    attribution: 'KEXP 90.3 FM Seattle',
  },
  // FIP Paris (Radio France) (both canonical verified catalogue ID and Radio Browser directory UUID)
  '7b6aca3d-dfa3-47dd-9f57-820b04c3f339': {
    url: 'https://www.radiofrance.fr/fip/assets/images/fip-square-logo.png',
    attribution: 'Radio France / FIP',
  },
  '960682df-0601-11e8-ae97-52543be04c81': {
    url: 'https://www.radiofrance.fr/fip/assets/images/fip-square-logo.png',
    attribution: 'Radio France / FIP',
  },
  // Radioeins rbb Berlin (both canonical verified catalogue ID and Radio Browser directory UUID)
  '9f899cb2-8dd7-11e8-aa66-52543be04c81': {
    url: 'https://www.radioeins.de/etc/medialib/rbb/rbb/logos/radioeins_logo.png',
    attribution: 'rbb Radioeins Berlin',
  },
  '9609f9ea-0601-11e8-ae97-52543be04c81': {
    url: 'https://www.radioeins.de/etc/medialib/rbb/rbb/logos/radioeins_logo.png',
    attribution: 'rbb Radioeins Berlin',
  },
  // Shonan Beach FM Japan
  '9f66a5b4-66c0-4389-88f3-f8285ad4239a': {
    url: 'https://www.beachfm.co.jp/wp-content/themes/beachfm/images/logo.png',
    attribution: 'Shonan Beach FM 78.9',
  },
  // WNYC 93.9 FM New York (both canonical verified catalogue ID and Radio Browser directory UUID)
  '535d3971-0a8f-4ccd-9dbe-2444bc7d339b': {
    url: 'https://media.wnyc.org/i/300/300/c/80/1/wnyc_logo.png',
    attribution: 'New York Public Radio / WNYC',
  },
  '960e6f66-0601-11e8-ae97-52543be04c81': {
    url: 'https://media.wnyc.org/i/300/300/c/80/1/wnyc_logo.png',
    attribution: 'New York Public Radio / WNYC',
  },
  // Worldwide FM London
  '9611b849-0601-11e8-ae97-52543be04c81': {
    url: 'https://worldwidefm.net/assets/logo.png',
    attribution: 'Worldwide FM London',
  },
  // NTS Radio London
  '9609c256-0601-11e8-ae97-52543be04c81': {
    url: 'https://media.nts.live/static/images/nts-logo.png',
    attribution: 'NTS Radio London',
  },
  // SomaFM Groove Salad (San Francisco)
  '9602e1c0-0601-11e8-ae97-52543be04c81': {
    url: 'https://somafm.com/img3/groovesalad400.jpg',
    attribution: 'SomaFM San Francisco',
  },
};

const NEGATIVE_CACHE_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes cooldown for failed URLs
const MAX_FAILED_URLS_CACHE = 500; // Bounded size for negative cache
const MAX_RESOLVED_CACHE = 500; // Bounded size for resolved artwork memory cache
const STORAGE_KEY_FAILED_URLS = '@fmx:artwork_failed_urls_v2';

export interface FallbackVisualProps {
  monogram: string;
  bars: [number, number, number, number];
  accentVariant: number;
  patternType: 'waves' | 'frequency' | 'radial';
  frequencyLabel?: string;
}

export class ArtworkService {
  private failedUrls: Map<string, number> = new Map();
  private resolvedCache: Map<string, StationArtwork> = new Map();
  private isStorageLoaded = false;
  private saveTimeout: any = null;

  constructor() {
    this.loadPersistedFailedUrls();
  }

  /**
   * Restores known failed URLs from AsyncStorage so negative cooldown survives app restart.
   */
  private async loadPersistedFailedUrls(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_FAILED_URLS);
      if (raw) {
        const parsed: Record<string, number> = JSON.parse(raw);
        const now = Date.now();
        for (const [url, timestamp] of Object.entries(parsed)) {
          if (now - timestamp < NEGATIVE_CACHE_COOLDOWN_MS) {
            this.failedUrls.set(url, timestamp);
          }
        }
      }
    } catch {
      // Storage unavailable or invalid JSON, degrade silently
    } finally {
      this.isStorageLoaded = true;
    }
  }

  /**
   * Persists failed URLs asynchronously with debouncing to avoid disk thrashing.
   */
  private persistFailedUrls(): void {
    if (this.saveTimeout) clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(async () => {
      try {
        const obj: Record<string, number> = {};
        const now = Date.now();
        for (const [url, ts] of this.failedUrls.entries()) {
          if (now - ts < NEGATIVE_CACHE_COOLDOWN_MS) {
            obj[url] = ts;
          }
        }
        await AsyncStorage.setItem(STORAGE_KEY_FAILED_URLS, JSON.stringify(obj));
      } catch {
        // Degrade silently
      }
    }, 1500);
  }

  /**
   * Fast, deterministic 32-bit FNV-1a hash algorithm.
   * Produces reproducible integer from any station ID or string.
   */
  public hashString(str: string): number {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  /**
   * Resolves the highest-priority artwork for a given radio station.
   * Strict Priority:
   * 1. Authoritative broadcaster source (matched by exact stable UUID / sourceStationId)
   * 2. Station record pre-verified broadcaster artwork (artworkSource === 'verified_broadcaster')
   * 3. Directory-supplied favicon/artwork URL (clearly distinct from official logos)
   * 4. Locally generated deterministic fmX branded cover
   * 5. Generic fallback for records with insufficient metadata
   */
  public resolveStationArtwork(station: RadioStation): StationArtwork {
    if (!station) {
      return {
        sourceType: 'generic_fallback',
        isOfficial: false,
        attribution: 'fmX Radio Audio',
        isFallback: true,
      };
    }

    // Check bounded resolved cache
    const cacheKey = `${station.id || 'unknown'}:${station.artworkUrl || ''}:${station.favicon || ''}`;
    if (this.resolvedCache.has(cacheKey)) {
      const cached = this.resolvedCache.get(cacheKey)!;
      // If cached URI is now failed, invalidate cache entry
      if (!cached.uri || !this.isUrlFailed(cached.uri)) {
        return cached;
      }
      this.resolvedCache.delete(cacheKey);
    }

    let result: StationArtwork;

    // 1. Authoritative verified broadcaster artwork (matched by exact UUID or sourceStationId)
    const matchedId =
      (station.id && VERIFIED_BROADCASTER_ARTWORK[station.id]) ? station.id :
      (station.sourceStationId && VERIFIED_BROADCASTER_ARTWORK[station.sourceStationId]) ? station.sourceStationId :
      null;

    if (matchedId) {
      const verified = VERIFIED_BROADCASTER_ARTWORK[matchedId];
      if (!this.isUrlFailed(verified.url)) {
        result = {
          uri: verified.url,
          sourceType: 'verified_broadcaster',
          isOfficial: true,
          attribution: verified.attribution,
          isFallback: false,
        };
        this.cacheResolvedArtwork(cacheKey, result);
        return result;
      }
    }

    // 2. Verified station record with explicit broadcaster artwork
    if (
      station.artworkSource === 'verified_broadcaster' &&
      station.artworkIsOfficial === true &&
      station.artworkUrl &&
      this.isValidImageUrl(station.artworkUrl) &&
      !this.isUrlFailed(station.artworkUrl)
    ) {
      result = {
        uri: station.artworkUrl.trim(),
        sourceType: 'verified_broadcaster',
        isOfficial: true,
        attribution: station.name,
        isFallback: false,
      };
      this.cacheResolvedArtwork(cacheKey, result);
      return result;
    }

    // 3. Directory record favicon / artwork URL (NEVER marked as official logo)
    const directoryUrl = (station.artworkUrl || station.favicon || '').trim();
    if (directoryUrl && this.isValidImageUrl(directoryUrl)) {
      if (!this.isUrlFailed(directoryUrl)) {
        result = {
          uri: directoryUrl,
          sourceType: 'directory_favicon',
          isOfficial: false, // Favicons are website icons, not official broadcaster logos
          attribution: 'Radio Browser Directory',
          isFallback: false,
        };
        this.cacheResolvedArtwork(cacheKey, result);
        return result;
      }
    }

    // 4. Insufficient metadata check -> Generic Fallback
    const hasMeaningfulName = Boolean(station.name && station.name.trim().length > 1 && station.name.trim() !== 'Unnamed Broadcast');
    if (!hasMeaningfulName && !station.city && !station.country) {
      result = {
        sourceType: 'generic_fallback',
        isOfficial: false,
        attribution: 'fmX Radio Audio',
        isFallback: true,
      };
      this.cacheResolvedArtwork(cacheKey, result);
      return result;
    }

    // 5. Locally generated deterministic fmX branded cover
    result = {
      sourceType: 'fmx_generated_fallback',
      isOfficial: false,
      attribution: 'fmX Tactical Audio Monogram',
      isFallback: true,
    };
    this.cacheResolvedArtwork(cacheKey, result);
    return result;
  }

  private cacheResolvedArtwork(key: string, artwork: StationArtwork): void {
    if (this.resolvedCache.size >= MAX_RESOLVED_CACHE) {
      const firstKey = this.resolvedCache.keys().next().value;
      if (firstKey) this.resolvedCache.delete(firstKey);
    }
    this.resolvedCache.set(key, artwork);
  }

  /**
   * Verifies URL validity:
   * - Must use http/https protocol
   * - Must not contain javascript: or data:
   * - Must not be a bare domain root without an image path (e.g. 'https://domain.com/')
   * - Must not be a non-image page extension (.html, .htm, .php, etc.)
   */
  public isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    const lower = trimmed.toLowerCase();

    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      return false;
    }

    if (lower.includes('javascript:') || lower.includes('data:')) {
      return false;
    }

    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.toLowerCase();

      // Disallow bare root domain without any path or file
      if (pathname === '' || pathname === '/') {
        return false;
      }

      // Disallow obvious HTML / server document extensions
      const invalidExtensions = [
        '.html',
        '.htm',
        '.php',
        '.asp',
        '.aspx',
        '.jsp',
        '.cgi',
        '.txt',
        '.pdf',
      ];
      if (invalidExtensions.some((ext) => pathname.endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Checks whether a URL is currently in the negative cache cooldown.
   */
  public isUrlFailed(url: string): boolean {
    if (!url) return false;
    const failedAt = this.failedUrls.get(url);
    if (!failedAt) return false;
    if (Date.now() - failedAt > NEGATIVE_CACHE_COOLDOWN_MS) {
      this.failedUrls.delete(url);
      return false;
    }
    return true;
  }

  /**
   * Records a failed network request or 404/broken image.
   * Evicts oldest entry if cache capacity is exceeded (FIFO bounded cache).
   */
  public recordImageLoadError(url?: string): void {
    if (!url) return;
    if (this.failedUrls.size >= MAX_FAILED_URLS_CACHE) {
      const oldestKey = this.failedUrls.keys().next().value;
      if (oldestKey) this.failedUrls.delete(oldestKey);
    }
    this.failedUrls.set(url, Date.now());
    this.resolvedCache.clear(); // Invalidate resolved cache so fallback is reflected immediately
    this.persistFailedUrls();
  }

  /**
   * Clears a URL from the failed cache when it successfully loads.
   */
  public recordImageLoadSuccess(url?: string): void {
    if (!url) return;
    this.failedUrls.delete(url);
  }

  /**
   * Clears all cache state (both in memory and persistent storage).
   */
  public async clearCache(): Promise<void> {
    this.failedUrls.clear();
    this.resolvedCache.clear();
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_FAILED_URLS);
    } catch {}
  }

  public getFailedUrlsCount(): number {
    return this.failedUrls.size;
  }

  public getResolvedCacheCount(): number {
    return this.resolvedCache.size;
  }

  /**
   * Generates deterministic visual properties for the fmX fallback cover.
   * Guarantees 100% identical styling across renders for the same station.
   */
  public getDeterministicVisualProps(station: RadioStation): FallbackVisualProps {
    const seedStr = `${station.id || ''}:${station.name || 'FM'}`;
    const hash = this.hashString(seedStr);

    // Compute monogram (2 characters, or 3 if short acronym like BBC, AIR)
    const words = (station.name || 'FM')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean);

    let monogram = 'FM';
    if (words.length >= 2) {
      monogram = (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1) {
      monogram = words[0].slice(0, 2).toUpperCase();
    }

    // Deterministic 4-bar normalized waveform heights between 0.25 and 1.0
    const b0 = 0.25 + (((hash >> 0) & 0xff) / 255) * 0.75;
    const b1 = 0.25 + (((hash >> 8) & 0xff) / 255) * 0.75;
    const b2 = 0.25 + (((hash >> 16) & 0xff) / 255) * 0.75;
    const b3 = 0.25 + (((hash >> 24) & 0xff) / 255) * 0.75;

    const accentVariant = hash % 3;
    const patternTypes: ('waves' | 'frequency' | 'radial')[] = ['waves', 'frequency', 'radial'];
    const patternType = patternTypes[hash % 3];

    return {
      monogram,
      bars: [
        parseFloat(b0.toFixed(2)),
        parseFloat(b1.toFixed(2)),
        parseFloat(b2.toFixed(2)),
        parseFloat(b3.toFixed(2)),
      ],
      accentVariant,
      patternType,
      frequencyLabel: station.frequency,
    };
  }

  /**
   * Computes an artwork coverage audit across any array of stations.
   * Returns precise counts and percentages.
   */
  public getArtworkCoverageStats(stations: RadioStation[]): {
    totalEvaluated: number;
    officialVerifiedArtwork: number;
    officialVerifiedPercentage: number;
    validDirectoryImages: number;
    validDirectoryPercentage: number;
    fmxGeneratedFallbacks: number;
    fmxGeneratedPercentage: number;
    genericFallbacks: number;
    brokenOrFailedImages: number;
  } {
    let validDirectoryImages = 0;
    let officialVerifiedArtwork = 0;
    let fmxGeneratedFallbacks = 0;
    let genericFallbacks = 0;
    let brokenOrFailedImages = 0;

    for (const station of stations) {
      const url = station.artworkUrl || station.favicon || '';
      if (url && this.isUrlFailed(url)) {
        brokenOrFailedImages++;
      }

      const resolved = this.resolveStationArtwork(station);
      if (resolved.sourceType === 'verified_broadcaster') {
        officialVerifiedArtwork++;
      } else if (resolved.sourceType === 'directory_favicon') {
        validDirectoryImages++;
      } else if (resolved.sourceType === 'generic_fallback') {
        genericFallbacks++;
      } else {
        fmxGeneratedFallbacks++;
      }
    }

    const total = stations.length;
    return {
      totalEvaluated: total,
      officialVerifiedArtwork,
      officialVerifiedPercentage: total > 0 ? parseFloat(((officialVerifiedArtwork / total) * 100).toFixed(1)) : 0,
      validDirectoryImages,
      validDirectoryPercentage: total > 0 ? parseFloat(((validDirectoryImages / total) * 100).toFixed(1)) : 0,
      fmxGeneratedFallbacks,
      fmxGeneratedPercentage: total > 0 ? parseFloat(((fmxGeneratedFallbacks / total) * 100).toFixed(1)) : 0,
      genericFallbacks,
      brokenOrFailedImages,
    };
  }
}

export const artworkService = new ArtworkService();

