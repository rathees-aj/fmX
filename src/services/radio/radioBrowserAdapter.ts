import { RadioStation, StationBoundingBox } from '../../types/station';
import { RadioDirectoryAdapter, StationQueryOptions } from './types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { streamHealthTracker } from '../audio/streamHealthTracker';
import { Platform } from 'react-native';
import { getRegionForCountryCode } from '../../utils/regionMapping';
import { KNOWN_GEOGRAPHIC_HUBS } from './verifiedCatalogue';
import { computeStationQualityBadge } from '../../utils/stationQuality';

export interface RadioBrowserRawStation {
  stationuuid: string;
  changeuuid?: string;
  name: string;
  url_resolved?: string;
  url?: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  iso_3166_2?: string;
  language?: string;
  languagecodes?: string;
  geo_lat?: number | null;
  geo_long?: number | null;
  bitrate?: number;
  codec?: string;
  hls?: number;
  lastcheckok?: number;
  lastchecktime?: string;
  lastcheckoktime?: string;
  votes?: number;
  clickcount?: number;
}

const RADIO_BROWSER_SEED_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://all.api.radio-browser.info',
];

const CACHE_PREFIX = '@fmx:radio_browser_cache:';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const MIRROR_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown for failed mirrors

export interface SearchDiagnostics {
  query: string;
  strategy: string;
  endpoints: string[];
  httpStatus?: number;
  rawCount: number;
  normalizedCount: number;
  dedupCount: number;
  validCoordsCount: number;
  error?: string | null;
}

export class RadioBrowserAdapter implements RadioDirectoryAdapter {
  readonly name = 'RadioBrowserAdapter';
  private currentMirrorIndex = 0;
  private discoveredMirrors: string[] = ['https://de1.api.radio-browser.info'];
  private failedMirrors: Map<string, number> = new Map();
  private lastServerDiscoveryTime = 0;
  private memoryCache: Map<string, { timestamp: number; data: RadioStation[] }> = new Map();
  private activeSearchController: AbortController | null = null;
  public lastDiagnostics: SearchDiagnostics | null = null;

  /**
   * Dynamically query Radio Browser server discovery endpoint to build active mirror pool.
   * Excludes known dead/unresponsive hosts and refreshes pool hourly.
   */
  public async discoverServers(): Promise<string[]> {
    if (Date.now() - this.lastServerDiscoveryTime < 60 * 60 * 1000 && this.discoveredMirrors.length > 0) {
      return this.discoveredMirrors;
    }

    const candidateSeeds = Array.from(
      new Set([...this.getHealthyMirrors(), ...RADIO_BROWSER_SEED_MIRRORS])
    );

    for (const seed of candidateSeeds) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${seed}/json/servers`, {
          headers: {
            Accept: 'application/json',
            'User-Agent': 'fmX-GlobalRadio/2.0 (contact@fmx.radio)',
          },
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (res.ok) {
          const servers: Array<{ name: string; ip: string }> = await res.json();
          if (Array.isArray(servers) && servers.length > 0) {
            const names = Array.from(
              new Set(
                servers
                  .map((s) => `https://${s.name}`)
                  .filter((m) => !m.includes('nl1.') && !m.includes('at1.')) // exclude dead DNS mirrors
              )
            );

            if (names.length > 0) {
              this.discoveredMirrors = names;
              this.lastServerDiscoveryTime = Date.now();
              return this.discoveredMirrors;
            }
          }
        }
      } catch (err) {
        clearTimeout(timer);
        this.failedMirrors.set(seed, Date.now());
      }
    }

    return this.discoveredMirrors;
  }

  private getHealthyMirrors(): string[] {
    const now = Date.now();
    const candidateList =
      this.discoveredMirrors.length > 0 ? this.discoveredMirrors : RADIO_BROWSER_SEED_MIRRORS;

    const healthy = candidateList.filter((m) => {
      const failedAt = this.failedMirrors.get(m);
      return !failedAt || now - failedAt > MIRROR_COOLDOWN_MS;
    });

    if (healthy.length === 0) {
      // Cooldown reset if all hosts failed
      this.failedMirrors.clear();
      return candidateList;
    }

    return healthy;
  }

  private get activeBaseUrl(): string {
    const healthy = this.getHealthyMirrors();
    return healthy[this.currentMirrorIndex % healthy.length];
  }

  private rotateMirror(failedUrl?: string) {
    if (failedUrl) {
      this.failedMirrors.set(failedUrl, Date.now());
    }
    const healthy = this.getHealthyMirrors();
    this.currentMirrorIndex = (this.currentMirrorIndex + 1) % healthy.length;
  }

  /**
   * Extracts broadcast frequency (e.g., '90.3 FM', '104.1 MHz') from station name or tags.
   */
  private extractFrequency(name: string, tags: string): string | undefined {
    const match = name.match(/(\d{2,3}(?:\.\d)?)\s*(?:FM|MHZ)/i) ||
                  tags.match(/(\d{2,3}(?:\.\d)?)\s*(?:FM|MHZ)/i);
    if (match) {
      return `${match[1]} FM`;
    }
    return undefined;
  }

  /**
   * Normalizes raw directory records into typed RadioStation.
   * Preserves valid stations without coordinates (hasCoordinates: false) instead of discarding them.
   */
  public normalizeStation(raw: RadioBrowserRawStation): RadioStation | null {
    if (!raw || !raw.stationuuid) return null;

    const streamUrl = (raw.url_resolved || raw.url || '').trim();
    if (!streamHealthTracker.isValidStreamUrl(streamUrl)) {
      return null;
    }

    // Latitude & Longitude validation
    const rawLat = typeof raw.geo_lat === 'number' ? raw.geo_lat : parseFloat(String(raw.geo_lat));
    const rawLng = typeof raw.geo_long === 'number' ? raw.geo_long : parseFloat(String(raw.geo_long));

    const hasValidCoords =
      !isNaN(rawLat) &&
      !isNaN(rawLng) &&
      rawLat >= -90 &&
      rawLat <= 90 &&
      rawLng >= -180 &&
      rawLng <= 180 &&
      (Math.abs(rawLat) > 0.001 || Math.abs(rawLng) > 0.001);

    const lat = hasValidCoords ? Number(rawLat.toFixed(4)) : 0;
    const lng = hasValidCoords ? Number(rawLng.toFixed(4)) : 0;

    // Genres & tags
    const rawGenres = (raw.tags || '')
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 1 && t.length < 24 && !/^[0-9]+$/.test(t))
      .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
      .slice(0, 4);

    const genres = rawGenres.length > 0 ? rawGenres : ['Radio'];
    const cleanName = (raw.name || 'Unnamed Broadcast').trim().replace(/[\n\r\t]/g, ' ');
    const rawState = (raw.state || '').trim();
    const country = (raw.country || 'Global').trim();
    const countryCode = (raw.countrycode || 'GL').trim().toUpperCase().substring(0, 2);

    // Authoritative location extraction:
    // Never equate city to country (eliminates "India, India").
    // Never guess Chennai solely because state is Tamil Nadu or language is Tamil.
    let state: string | undefined = undefined;
    let city: string | undefined = undefined;

    if (rawState && rawState.toLowerCase() !== country.toLowerCase()) {
      // Check if rawState matches a known geographic metropolitan hub (e.g. Chennai, London, Seattle, etc.)
      const matchingHub = KNOWN_GEOGRAPHIC_HUBS.find(
        (h) =>
          h.city.toLowerCase() === rawState.toLowerCase() ||
          h.aliases.some((a) => a.toLowerCase() === rawState.toLowerCase())
      );

      if (matchingHub) {
        city = matchingHub.city;
        state = matchingHub.state;
      } else {
        state = rawState;
      }
    }

    // Languages parsing
    const languages = (raw.language || '')
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
      .map((l) => l.charAt(0).toUpperCase() + l.slice(1));

    const languageCodes = (raw.languagecodes || '')
      .split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    const frequency = this.extractFrequency(cleanName, raw.tags || '');
    const isHls =
      raw.hls === 1 ||
      (raw.codec?.toUpperCase() === 'HLS') ||
      streamUrl.includes('.m3u8') ||
      streamUrl.includes('mpegurl');

    const isLastCheckOk = raw.lastcheckok === 1;

    const station: RadioStation = {
      id: raw.stationuuid,
      name: cleanName,
      city: city || undefined,
      state: state || undefined,
      country,
      countryCode,
      iso_3166_2: raw.iso_3166_2?.trim() || undefined,
      language: raw.language?.trim() || undefined,
      languages: languages.length > 0 ? languages : undefined,
      languageCodes: languageCodes.length > 0 ? languageCodes : undefined,
      region: getRegionForCountryCode(countryCode),
      latitude: lat,
      longitude: lng,
      hasCoordinates: hasValidCoords,
      frequency,
      genres,
      streamUrl,
      urlResolved: raw.url_resolved?.trim() || undefined,
      bitrate: raw.bitrate && raw.bitrate > 0 ? raw.bitrate : 128,
      codec: (raw.codec?.toUpperCase() as any) || (isHls ? 'HLS' : 'MP3'),
      homepage: raw.homepage?.trim() || undefined,
      favicon: raw.favicon?.trim() || undefined,
      hls: isHls,
      provider: 'radio-browser',
      sourceStationId: raw.stationuuid,
      changeuuid: raw.changeuuid?.trim() || undefined,
      votes: typeof raw.votes === 'number' ? raw.votes : undefined,
      clickCount: typeof raw.clickcount === 'number' ? raw.clickcount : undefined,
      lastCheckOk: isLastCheckOk,
      lastCheckTime: raw.lastchecktime?.trim() || undefined,
      lastCheckOkTime: raw.lastcheckoktime?.trim() || undefined,
      directoryRecordAvailable: true,
      directoryHealthPassed: isLastCheckOk,
      streamReachable: null,
      playbackSucceeded: null,
      isLocationVerified: hasValidCoords,
      isIdentityVerified: true,
      isStreamVerified: isLastCheckOk,
    };

    station.qualityBadge = computeStationQualityBadge(station);
    return station;
  }

  /**
   * Stable deduplication strictly by stationuuid and normalized stream URL.
   * Never merges different stations solely because they share names or countries.
   */
  public deduplicateStations(stations: RadioStation[]): RadioStation[] {
    const seenUuids = new Set<string>();
    const seenUrls = new Set<string>();
    const unique: RadioStation[] = [];

    for (const s of stations) {
      if (s.id && seenUuids.has(s.id)) continue;

      const normUrl = s.streamUrl
        ? s.streamUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
        : '';
      if (normUrl && seenUrls.has(normUrl)) continue;

      if (s.id) seenUuids.add(s.id);
      if (normUrl) seenUrls.add(normUrl);
      unique.push(s);
    }

    return unique;
  }

  /**
   * Resilient HTTP fetch with timeout, mirror failover, external abort signal, and retry backoff.
   */
  private async fetchFromDirectory(
    endpoint: string,
    retries = 2,
    timeoutMs = 6000,
    externalSignal?: AbortSignal
  ): Promise<any> {
    await this.discoverServers();
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      if (externalSignal?.aborted) {
        throw new Error('Directory search was cancelled by a newer query');
      }

      const baseUrl = this.activeBaseUrl;
      const url = `${baseUrl}${endpoint}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      // Link external signal to local controller if provided
      const abortHandler = () => controller.abort();
      if (externalSignal) {
        externalSignal.addEventListener('abort', abortHandler, { once: true });
      }

      try {
        const reqHeaders: Record<string, string> = {
          Accept: 'application/json',
          'User-Agent': 'fmX-GlobalRadio/2.0 (contact@fmx.radio)',
        };

        const response = await fetch(url, {
          headers: reqHeaders,
          signal: controller.signal,
        });

        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', abortHandler);
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${baseUrl}`);
        }

        return await response.json();
      } catch (err: any) {
        clearTimeout(timer);
        if (externalSignal) {
          externalSignal.removeEventListener('abort', abortHandler);
        }

        if (externalSignal?.aborted) {
          throw new Error('Directory search was cancelled by a newer query');
        }

        lastError = err;
        this.rotateMirror(baseUrl); // Mark failing mirror and rotate
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 350 * Math.pow(2, attempt)));
        }
      }
    }

    throw lastError || new Error('All directory mirrors failed');
  }

  /**
   * In-memory + persistent cache lookup with optional stale cache fallback
   */
  private async getFromCache(key: string, allowExpired = false): Promise<RadioStation[] | null> {
    const mem = this.memoryCache.get(key);
    if (mem && (allowExpired || Date.now() - mem.timestamp < CACHE_TTL_MS)) {
      return mem.data;
    }

    try {
      const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (allowExpired || Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          this.memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {}

    return null;
  }

  private async saveToCache(key: string, data: RadioStation[]): Promise<void> {
    const record = { timestamp: Date.now(), data };
    this.memoryCache.set(key, record);
    try {
      await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(record));
    } catch {}
  }

  async getCuratedStations(limit = 36): Promise<RadioStation[]> {
    const cacheKey = `curated_${limit}`;
    const cached = await this.getFromCache(cacheKey, false);
    if (cached && cached.length > 0) return cached;

    try {
      // Query top-voted stations that have confirmed coordinates
      const endpoint = `/json/stations/search?has_geo_info=true&limit=${limit * 2}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = data
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);

      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
        return unique;
      }
    } catch (err) {
      console.warn('[fmX Directory] Live curated fetch failed, attempting stale cache fallback:', err);
    }

    // Offline / network failure: fallback to stale cache
    let stale = await this.getFromCache(cacheKey, true);
    if (!stale || stale.length === 0) {
      stale = await this.getFromCache('curated_36', true);
    }
    return stale || [];
  }

  async searchStations(options: StationQueryOptions | string): Promise<RadioStation[]> {
    const opt: StationQueryOptions =
      typeof options === 'string' ? { query: options } : options;

    const query = opt.query?.trim() || '';
    const limit = Math.min(opt.limit || 30, 80);
    const offset = opt.offset || 0;

    // Cancel prior in-flight search to avoid race conditions
    if (this.activeSearchController) {
      this.activeSearchController.abort();
    }
    this.activeSearchController = new AbortController();
    const currentSignal = this.activeSearchController.signal;

    const endpointsToQuery: string[] = [];
    if (query) {
      // Multi-field query: search by name, state/city, tag/genre, country, and language
      const baseParams = new URLSearchParams();
      baseParams.set('limit', String(limit));
      baseParams.set('offset', String(offset));
      baseParams.set('order', 'votes');
      baseParams.set('reverse', 'true');
      if (opt.codec) baseParams.set('codec', opt.codec);
      if (opt.countryCode) baseParams.set('countrycode', opt.countryCode);
      if (opt.tag) baseParams.set('tag', opt.tag);
      if (opt.language) baseParams.set('language', opt.language);
      if (opt.state) baseParams.set('state', opt.state);
      if (opt.country) baseParams.set('country', opt.country);
      if (opt.hasGeoOnly) baseParams.set('has_geo_info', 'true');

      // Primary multi-field endpoints
      endpointsToQuery.push(`/json/stations/search?name=${encodeURIComponent(query)}&${baseParams.toString()}`);
      endpointsToQuery.push(`/json/stations/search?state=${encodeURIComponent(query)}&${baseParams.toString()}`);
      endpointsToQuery.push(`/json/stations/search?tag=${encodeURIComponent(query)}&${baseParams.toString()}`);
      endpointsToQuery.push(`/json/stations/search?country=${encodeURIComponent(query)}&${baseParams.toString()}`);
      endpointsToQuery.push(`/json/stations/search?language=${encodeURIComponent(query)}&${baseParams.toString()}`);

      // Multi-word token support (e.g. "AIR Vividh Bharati" -> query "Vividh Bharati", "AIR")
      const words = query.split(/\s+/).filter((w) => w.length >= 3);
      if (words.length > 1) {
        // Query remaining phrases or key tokens
        const subPhrase = words.slice(1).join(' ');
        if (subPhrase.length >= 3) {
          endpointsToQuery.push(`/json/stations/search?name=${encodeURIComponent(subPhrase)}&${baseParams.toString()}`);
        }
        for (const word of words) {
          endpointsToQuery.push(`/json/stations/search?name=${encodeURIComponent(word)}&${baseParams.toString()}`);
        }
      }

      // Unicode script mapping (e.g. தமிழ் -> language: tamil, हिन्दी -> language: hindi)
      if (query.includes('தமிழ்')) {
        endpointsToQuery.push(`/json/stations/search?language=tamil&${baseParams.toString()}`);
      }
      if (query.includes('हिन्दी') || query.includes('हिंदी')) {
        endpointsToQuery.push(`/json/stations/search?language=hindi&${baseParams.toString()}`);
      }
    } else {
      const params = new URLSearchParams();
      params.set('limit', String(limit * 2));
      params.set('offset', String(offset));
      params.set('order', 'votes');
      params.set('reverse', 'true');
      if (opt.name) params.set('name', opt.name);
      if (opt.state) params.set('state', opt.state);
      if (opt.countryCode) params.set('countrycode', opt.countryCode);
      if (opt.country) params.set('country', opt.country);
      if (opt.tag) params.set('tag', opt.tag);
      if (opt.language) params.set('language', opt.language);
      if (opt.codec) params.set('codec', opt.codec);
      if (opt.hasGeoOnly) params.set('has_geo_info', 'true');
      endpointsToQuery.push(`/json/stations/search?${params.toString()}`);
    }

    const cacheKey = `search_${query}_${opt.countryCode || ''}_${opt.tag || ''}_${opt.language || ''}_${opt.codec || ''}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey, false);
    if (cached && cached.length > 0) return cached;

    let rawRecords: RadioBrowserRawStation[] = [];
    let lastError: Error | null = null;

    try {
      // Query multi-field endpoints concurrently
      const results = await Promise.allSettled(
        endpointsToQuery.map((ep) => this.fetchFromDirectory(ep, 1, 5000, currentSignal))
      );

      for (const res of results) {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          rawRecords.push(...res.value);
        } else if (res.status === 'rejected') {
          lastError = res.reason;
        }
      }
    } catch (err: any) {
      if (currentSignal.aborted) {
        return [];
      }
      lastError = err;
    }

    const rawCount = rawRecords.length;
    const normalized = rawRecords
      .map((s) => this.normalizeStation(s))
      .filter((s): s is RadioStation => s !== null);

    const unique = this.deduplicateStations(normalized).slice(0, limit);
    const validCoordsCount = unique.filter((s) => s.hasCoordinates !== false && (Math.abs(s.latitude) > 0.001 || Math.abs(s.longitude) > 0.001)).length;

    this.lastDiagnostics = {
      query,
      strategy: query ? 'multi-field (name, state, tag)' : 'parameterized',
      endpoints: endpointsToQuery,
      rawCount,
      normalizedCount: normalized.length,
      dedupCount: unique.length,
      validCoordsCount,
      error: rawCount === 0 && lastError ? lastError.message : null,
    };

    console.log(
      `[fmX Directory Search] query="${query}" raw=${rawCount} normalized=${normalized.length} dedup=${unique.length} withCoords=${validCoordsCount} error=${this.lastDiagnostics.error || 'none'}`
    );

    if (unique.length > 0) {
      await this.saveToCache(cacheKey, unique);
      return unique;
    }

    if (lastError && rawCount === 0) {
      // Stale cache fallback if available
      const stale = await this.getFromCache(cacheKey, true);
      if (stale && stale.length > 0) return stale;
      throw lastError;
    }

    return [];
  }

  async getStationsInBounds(bounds: StationBoundingBox, limit = 30): Promise<RadioStation[]> {
    const cacheKey = `bounds_${bounds.minLat.toFixed(1)}_${bounds.maxLat.toFixed(1)}_${bounds.minLng.toFixed(1)}_${bounds.maxLng.toFixed(1)}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      // Radio Browser does not have a native bbox endpoint, so query top geo-stations and filter
      const endpoint = `/json/stations/search?has_geo_info=true&limit=150&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = data
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);

      const inBounds = normalized.filter(
        (s) =>
          s.latitude >= bounds.minLat &&
          s.latitude <= bounds.maxLat &&
          s.longitude >= bounds.minLng &&
          s.longitude <= bounds.maxLng
      );

      const unique = this.deduplicateStations(inBounds).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getStationById(id: string): Promise<RadioStation | null> {
    try {
      const endpoint = `/json/stations/byuuid/${id}`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      if (Array.isArray(data) && data[0]) {
        return this.normalizeStation(data[0]);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolves a station's live stream URL and registers a click count via Radio Browser /json/url/{stationuuid}
   */
  async resolveStreamUrl(stationUuid: string): Promise<string | null> {
    try {
      const endpoint = `/json/url/${encodeURIComponent(stationUuid)}`;
      const data: any = await this.fetchFromDirectory(endpoint, 2, 4000);
      if (data && typeof data === 'object' && data.url && streamHealthTracker.isValidStreamUrl(data.url)) {
        return (data.url as string).trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  async getCountries(limit = 100): Promise<Array<{ name: string; code: string; stationCount: number }>> {
    try {
      const data: any[] = await this.fetchFromDirectory(`/json/countries?order=stationcount&reverse=true`, 1, 5000);
      if (Array.isArray(data)) {
        return data.slice(0, limit).map((c) => ({
          name: c.name || 'Unknown',
          code: c.iso_3166_1 || '',
          stationCount: c.stationcount || 0,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStatesByCountry(country: string, limit = 100): Promise<Array<{ name: string; country: string; stationCount: number }>> {
    const trimmed = (country || '').trim();
    if (!trimmed) return [];
    try {
      const endpoint = `/json/states/${encodeURIComponent(trimmed)}?order=stationcount&reverse=true`;
      const data: any[] = await this.fetchFromDirectory(endpoint, 1, 5000);
      if (Array.isArray(data)) {
        return data
          .filter((s) => s.name && s.name.trim() && s.name.toLowerCase() !== trimmed.toLowerCase())
          .slice(0, limit)
          .map((s) => ({
            name: s.name.trim(),
            country: s.country || trimmed,
            stationCount: s.stationcount || 0,
          }));
      }
      return [];
    } catch (err) {
      console.warn(`[fmX Directory] getStatesByCountry failed for ${trimmed}:`, err);
      return [];
    }
  }

  async getStationsByCountryAndState(countryCode: string, state: string, limit = 50, offset = 0): Promise<RadioStation[]> {
    const code = countryCode.trim().toUpperCase();
    const st = state.trim();
    const cacheKey = `by_country_state_${code}_${st}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/search?countrycode=${encodeURIComponent(code)}&state=${encodeURIComponent(st)}&limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getStationsByCity(countryCode: string, city: string, limit = 50, offset = 0): Promise<RadioStation[]> {
    const code = countryCode.trim().toUpperCase();
    const c = city.trim();
    const cacheKey = `by_city_${code}_${c}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/search?countrycode=${encodeURIComponent(code)}&state=${encodeURIComponent(c)}&limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getLanguages(limit = 50): Promise<Array<{ name: string; stationCount: number }>> {
    try {
      const data: any[] = await this.fetchFromDirectory(`/json/languages?order=stationcount&reverse=true`, 1, 5000);
      if (Array.isArray(data)) {
        return data.slice(0, limit).map((l) => ({
          name: l.name || 'Unknown',
          stationCount: l.stationcount || 0,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async getTags(limit = 50): Promise<Array<{ name: string; stationCount: number }>> {
    try {
      const data: any[] = await this.fetchFromDirectory(`/json/tags?order=stationcount&reverse=true`, 1, 5000);
      if (Array.isArray(data)) {
        return data.slice(0, limit).map((t) => ({
          name: t.name || 'Unknown',
          stationCount: t.stationcount || 0,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  async getAllStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    const cacheKey = `all_stations_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getStationsByCountryCode(countryCode: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    const code = countryCode.trim().toUpperCase();
    const cacheKey = `by_country_${code}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/bycountrycodeexact/${encodeURIComponent(code)}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getStationsByLanguage(language: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    const lang = language.trim().toLowerCase();
    const cacheKey = `by_language_${lang}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/bylanguage/${encodeURIComponent(lang)}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getStationsByTag(tag: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    const t = tag.trim().toLowerCase();
    const cacheKey = `by_tag_${t}_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/bytag/${encodeURIComponent(t)}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getTopVotedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    const cacheKey = `top_voted_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/topvote/${limit * 2}?offset=${offset}`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getTopClickedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    const cacheKey = `top_clicked_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/topclick/${limit * 2}?offset=${offset}`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getRecentlyUpdatedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    const cacheKey = `last_change_${limit}_${offset}`;
    const cached = await this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = `/json/stations/lastchange/${limit * 2}?offset=${offset}`;
      const data: RadioBrowserRawStation[] = await this.fetchFromDirectory(endpoint);
      const normalized = (data || [])
        .map((s) => this.normalizeStation(s))
        .filter((s): s is RadioStation => s !== null);
      const unique = this.deduplicateStations(normalized).slice(0, limit);
      if (unique.length > 0) {
        await this.saveToCache(cacheKey, unique);
      }
      return unique;
    } catch {
      return [];
    }
  }

  async getCountryCodes(limit = 100): Promise<Array<{ code: string; stationCount: number }>> {
    try {
      const data: any[] = await this.fetchFromDirectory(`/json/countrycodes?order=stationcount&reverse=true`, 1, 5000);
      if (Array.isArray(data)) {
        return data.slice(0, limit).map((c) => ({
          code: c.name || '',
          stationCount: c.stationcount || 0,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }
}
