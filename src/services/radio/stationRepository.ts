import { RadioStation, StationBoundingBox } from '../../types/station';
import { RadioDirectoryAdapter, StationQueryOptions } from './types';
import { RadioBrowserAdapter } from './radioBrowserAdapter';
import { RadioGardenAdapter } from './radioGardenAdapter';
import { compareStationIdentity } from './stationIdentityMatcher';
import { localFavoritesStorage, localHistoryStorage } from '../../lib/storage';
import { streamHealthTracker } from '../audio/streamHealthTracker';
import { VERIFIED_GLOBAL_STATIONS, KNOWN_GEOGRAPHIC_HUBS } from './verifiedCatalogue';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { calculateBoundingBox, filterAndSortStationsByDistance, isValidCoordinate } from '../../utils/geoDistance';

export interface StationCatalogueStats {
  totalRecordsFetched: number;
  uniqueStationsCount: number;
  geolocatedStationsCount: number;
  selectedStationName: string | null;
}

/**
 * Calculates relevance weight for a station matching a search query.
 * Prioritizes:
 * 1. Exact station name matches (100)
 * 2. Exact city matches (85)
 * 3. Partial city / station name matches (55-60)
 * 4. State or region matches (35-50)
 * 5. Tag / genre matches (20-45)
 * 6. Country matches (15-30)
 */
export function calculateStationRelevance(station: RadioStation, query: string): number {
  if (!query) return 1;
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const name = (station.name || '').toLowerCase();
  const city = (station.city || '').toLowerCase();
  const state = (station.state || '').toLowerCase();
  const country = (station.country || '').toLowerCase();
  const countryCode = (station.countryCode || '').toLowerCase();
  const genres = (station.genres || []).map((g) => g.toLowerCase());
  const lang = (station.language || '').toLowerCase();
  const langs = (station.languages || []).map((l) => l.toLowerCase());

  let score = 0;

  // 1. Station name matching
  if (name === q) {
    score += 120;
  } else if (name.startsWith(q)) {
    score += 85;
  } else if (name.includes(q)) {
    score += 65;
  } else if (q.includes(name) && name.length >= 3) {
    score += 65;
  }

  // 2. City matching
  if (city === q) {
    score += 85;
  } else if (city.startsWith(q) || city.includes(q)) {
    score += 55;
  }

  // 3. State / administrative region matching
  if (state === q) {
    score += 55;
  } else if (state.includes(q)) {
    score += 35;
  }

  // 4. Genres / tags matching
  if (genres.some((g) => g === q)) {
    score += 50;
  } else if (genres.some((g) => g.includes(q))) {
    score += 25;
  }

  // 5. Language matching (including Tamil, Hindi, etc.)
  if (lang === q || langs.includes(q)) {
    score += 85;
  } else if (lang.includes(q) || langs.some((l) => l.includes(q))) {
    score += 55;
  }

  // 6. Country / CountryCode matching
  if (country === q || countryCode === q) {
    score += 45;
  } else if (country.includes(q)) {
    score += 20;
  }

  // 7. Unicode & native language script handling (Tamil, Hindi)
  if (q.includes('தமிழ்')) {
    if (lang === 'tamil' || langs.includes('tamil') || state.includes('tamil') || genres.some((g) => g.includes('tamil'))) {
      score += 90;
    }
  }
  if (q.includes('हिन्दी') || q.includes('हिंदी')) {
    if (lang === 'hindi' || langs.includes('hindi') || genres.some((g) => g.includes('hindi'))) {
      score += 90;
    }
  }

  // 8. Multi-token / multi-word matching (e.g. "AIR Vividh Bharati", "BBC World", "89.4 Tamil")
  const tokens = q.split(/[\s,.-]+/).filter((t) => t.length >= 2);
  if (tokens.length > 1) {
    const fullText = `${name} ${city} ${state} ${country} ${countryCode} ${genres.join(' ')} ${lang} ${langs.join(' ')}`;
    const words = fullText.split(/[\s,.-]+/).filter((w) => w.length >= 2);
    const matchedTokens = tokens.filter((t) => words.includes(t) || words.some((w) => w.startsWith(t) && t.length >= 4));
    if (matchedTokens.length === tokens.length) {
      score += 75; // All tokens match
    } else if (tokens.length >= 3 && matchedTokens.length >= 2) {
      score += Math.round(40 * (matchedTokens.length / tokens.length));
    }
  }

  return score;
}

export class StationRepository {
  private primaryAdapter: RadioDirectoryAdapter;
  private secondaryAdapter?: RadioDirectoryAdapter;
  private catalogue: Map<string, RadioStation> = new Map();
  private totalRecordsFetchedCounter = 0;
  public lastSearchError: string | null = null;

  constructor(primary?: RadioDirectoryAdapter, secondary?: RadioDirectoryAdapter) {
    this.primaryAdapter = primary || new RadioBrowserAdapter();
    this.secondaryAdapter = secondary || new RadioGardenAdapter();
    // Initialize Layer A catalogue with verified global radio stations
    for (const s of VERIFIED_GLOBAL_STATIONS) {
      this.catalogue.set(s.id, s);
    }
  }

  public setSecondaryAdapter(adapter?: RadioDirectoryAdapter): void {
    this.secondaryAdapter = adapter;
  }

  private async attachFavoriteFlags(stations: RadioStation[]): Promise<RadioStation[]> {
    const favIds = new Set(await localFavoritesStorage.getFavorites());
    return stations.map((s) => ({
      ...s,
      isFavorite: favIds.has(s.id),
    }));
  }

  /**
   * Retrieve curated global stations from the real directory adapter.
   * Expands catalogue while keeping visible markers bounded on the globe.
   */
  async getCuratedStations(limit = 80): Promise<RadioStation[]> {
    try {
      const directoryStations = await this.primaryAdapter.getCuratedStations(limit);
      this.totalRecordsFetchedCounter += directoryStations.length;

      for (const s of directoryStations) {
        this.catalogue.set(s.id, s);
      }

      const all = Array.from(this.catalogue.values());
      return await this.attachFavoriteFlags(all);
    } catch (err) {
      console.warn('[fmX Repository] Live curated fetch failed, returning local catalogue:', err);
      const all = Array.from(this.catalogue.values());
      return await this.attachFavoriteFlags(all);
    }
  }

  /**
   * Layered Search Strategy:
   * Layer A — Search local catalogue across name, city, state, country, tags.
   * Layer B — Query remote directory across multi-field endpoints.
   * Layer C — Geographic hub fallback for verified global cities.
   * Merges, deduplicates, and ranks by relevance.
   */
  async search(options: StationQueryOptions | string): Promise<RadioStation[]> {
    const query = typeof options === 'string' ? options.trim() : options.query?.trim() || '';
    const isPaging = Boolean(typeof options !== 'string' && options.offset && options.offset > 0);
    this.lastSearchError = null;

    if (!query && typeof options === 'string') {
      return this.getCuratedStations();
    }

    const qLower = query.toLowerCase();
    const candidateMap = new Map<string, RadioStation>();

    // Layer A: Search local catalogue ONLY for the initial page (offset === 0)
    if (!isPaging) {
      for (const station of this.catalogue.values()) {
        // When filtering by tag, enforce genre match on local catalogue
        if (typeof options !== 'string' && options.tag) {
          const t = options.tag.toLowerCase();
          if (!station.genres.some((g) => g.toLowerCase().includes(t))) continue;
        }
        // When filtering by language, enforce language match on local catalogue
        if (typeof options !== 'string' && options.language) {
          const l = options.language.toLowerCase();
          const matchesLang =
            station.language?.toLowerCase() === l ||
            station.languages?.some((lang) => lang.toLowerCase().includes(l));
          if (!matchesLang) continue;
        }
        // When filtering by countryCode, enforce country code match on local catalogue
        if (typeof options !== 'string' && options.countryCode) {
          if (station.countryCode.toLowerCase() !== options.countryCode.toLowerCase()) continue;
        }

        const score = calculateStationRelevance(station, query);
        if (score > 0) {
          candidateMap.set(station.id, station);
        }
      }
    }

    // Layer C: Geographic hub lookup if query matches known city/region (only for offset === 0)
    let matchingHub = null;
    if (!isPaging && query) {
      matchingHub = KNOWN_GEOGRAPHIC_HUBS.find(
        (h) =>
          h.city.toLowerCase() === qLower ||
          h.aliases.some((a) => a === qLower || qLower.includes(a)) ||
          (h.state && h.state.toLowerCase() === qLower)
      );

      if (matchingHub) {
        for (const s of VERIFIED_GLOBAL_STATIONS) {
          if (
            (s.city && s.city.toLowerCase() === matchingHub.city.toLowerCase()) ||
            (matchingHub.state && s.state?.toLowerCase() === matchingHub.state.toLowerCase())
          ) {
            this.catalogue.set(s.id, s);
            candidateMap.set(s.id, s);
          }
        }
      }
    }

    // Layer B: Remote directory search (Primary Provider - Radio Browser)
    let remoteError: Error | null = null;
    try {
      const remoteResults = await this.primaryAdapter.searchStations(options);
      this.totalRecordsFetchedCounter += remoteResults.length;

      for (const s of remoteResults) {
        this.catalogue.set(s.id, s);
        candidateMap.set(s.id, s);
      }
    } catch (err: any) {
      remoteError = err;
      this.lastSearchError = err?.message || 'Remote directory unreachable';
      console.warn('[fmX Repository] Primary directory search failed:', err);
    }

    // Layer B2: Secondary Provider (Experimental Radio Garden)
    if (this.secondaryAdapter) {
      try {
        const secondaryResults = await this.secondaryAdapter.searchStations(options);
        this.totalRecordsFetchedCounter += secondaryResults.length;
        for (const s of secondaryResults) {
          const existing = Array.from(candidateMap.values());
          let shouldAdd = true;
          for (const cand of existing) {
            const comparison = compareStationIdentity(s, cand);
            if (comparison.conflictWarning) {
              console.warn('[fmX Identity Conflict]', comparison.conflictWarning);
            }
            if (comparison.isSameStation) {
              shouldAdd = false;
              if (!cand.homepage && s.homepage) cand.homepage = s.homepage;
              break;
            }
          }
          if (shouldAdd) {
            this.catalogue.set(s.id, s);
            candidateMap.set(s.id, s);
          }
        }
      } catch (err) {
        console.warn('[fmX Repository] Secondary provider search skipped / unavailable:', err);
      }
    }

    // Deduplicate and rank by relevance
    const unique = this.deduplicateStations(Array.from(candidateMap.values()));
    const ranked = unique.sort((a, b) => {
      const scoreA = calculateStationRelevance(a, query);
      const scoreB = calculateStationRelevance(b, query);
      return scoreB - scoreA;
    });

    console.log(
      `[fmX Repository Search] query="${query}" isPaging=${isPaging} localMatches=${candidateMap.size} uniqueRanked=${ranked.length} hubMatch=${matchingHub ? matchingHub.city : 'none'}`
    );

    if (ranked.length === 0 && remoteError) {
      throw remoteError;
    }

    return await this.attachFavoriteFlags(ranked);
  }

  /**
   * Deduplicate stations using conservative Station Identity Matcher.
   * Prevents merging distinct broadcasters and logs identity conflicts.
   */
  public deduplicateStations(stations: RadioStation[]): RadioStation[] {
    const unique: RadioStation[] = [];

    for (const s of stations) {
      let isDuplicate = false;
      for (const existing of unique) {
        const comparison = compareStationIdentity(s, existing);
        if (comparison.conflictWarning) {
          console.warn('[fmX Identity Conflict]', comparison.conflictWarning);
        }
        if (comparison.isSameStation) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) {
        unique.push(s);
      }
    }

    return unique;
  }

  /**
   * Fetch progressive stations for a continent region, language or genre filter
   */
  async fetchRegionBatch(regionCode: string, limit = 40): Promise<RadioStation[]> {
    try {
      let opt: StationQueryOptions = { limit };
      if (regionCode === 'INDIA') {
        opt.countryCode = 'IN';
      } else if (regionCode === 'ASIA') {
        opt.countryCode = 'JP'; // Diversify ASIA search beyond India
      } else if (regionCode === 'EUROPE') {
        opt.countryCode = 'GB';
      } else if (regionCode === 'NORTH_AMERICA') {
        opt.countryCode = 'US';
      } else if (regionCode === 'AFRICA') {
        opt.countryCode = 'ZA';
      } else if (regionCode === 'SOUTH_AMERICA') {
        opt.countryCode = 'BR';
      } else if (regionCode === 'OCEANIA') {
        opt.countryCode = 'AU';
      } else if (regionCode === 'TAMIL') {
        opt.language = 'tamil';
      } else if (regionCode === 'HINDI') {
        opt.language = 'hindi';
      } else {
        opt.tag = regionCode.toLowerCase();
      }

      const results = await this.primaryAdapter.searchStations(opt);
      this.totalRecordsFetchedCounter += results.length;

      for (const s of results) {
        this.catalogue.set(s.id, s);
      }

      return await this.attachFavoriteFlags(Array.from(this.catalogue.values()));
    } catch (err) {
      console.warn('[fmX Repository] Region batch fetch failed:', err);
      return Array.from(this.catalogue.values());
    }
  }

  async getStationsByCountryCode(countryCode: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getStationsByCountryCode) {
        const stations = await this.primaryAdapter.getStationsByCountryCode(countryCode, limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStationsByLanguage(language: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getStationsByLanguage) {
        const stations = await this.primaryAdapter.getStationsByLanguage(language, limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStationsByTag(tag: string, limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getStationsByTag) {
        const stations = await this.primaryAdapter.getStationsByTag(tag, limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getTopVotedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getTopVotedStations) {
        const stations = await this.primaryAdapter.getTopVotedStations(limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getTopClickedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getTopClickedStations) {
        const stations = await this.primaryAdapter.getTopClickedStations(limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getRecentlyUpdatedStations(limit = 40, offset = 0): Promise<RadioStation[]> {
    try {
      if (this.primaryAdapter.getRecentlyUpdatedStations) {
        const stations = await this.primaryAdapter.getRecentlyUpdatedStations(limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getCountryCodes(limit = 100): Promise<Array<{ code: string; stationCount: number }>> {
    try {
      if (this.primaryAdapter.getCountryCodes) {
        return await this.primaryAdapter.getCountryCodes(limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getCountries(limit = 100): Promise<Array<{ name: string; code: string; stationCount: number }>> {
    try {
      if (this.primaryAdapter.getCountries) {
        return await this.primaryAdapter.getCountries(limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getLanguages(limit = 50): Promise<Array<{ name: string; stationCount: number }>> {
    try {
      if (this.primaryAdapter.getLanguages) {
        return await this.primaryAdapter.getLanguages(limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getTags(limit = 50): Promise<Array<{ name: string; stationCount: number }>> {
    try {
      if (this.primaryAdapter.getTags) {
        return await this.primaryAdapter.getTags(limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStationsInBounds(bounds: StationBoundingBox): Promise<RadioStation[]> {
    try {
      const stations = await this.primaryAdapter.getStationsInBounds(bounds, 40);
      this.totalRecordsFetchedCounter += stations.length;

      for (const s of stations) {
        this.catalogue.set(s.id, s);
      }
      return await this.attachFavoriteFlags(stations);
    } catch {
      return [];
    }
  }

  /**
   * Retrieves stations within a given radius in kilometers from the listener's coordinates.
   * Utilizes 15-minute cell-based caching, Haversine distance calculations, and repository deduplication.
   */
  async getNearbyStations(
    latitude: number,
    longitude: number,
    radiusKm: number = 50,
    forceRefresh: boolean = false
  ): Promise<RadioStation[]> {
    if (!isValidCoordinate(latitude, longitude)) {
      return [];
    }

    const roundedCell = `${latitude.toFixed(2)}_${longitude.toFixed(2)}_${radiusKm}km`;
    const cacheKey = `@fmx:nearby_cache:${roundedCell}`;
    const TTL_MS = 15 * 60 * 1000; // 15 minutes

    if (!forceRefresh) {
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.timestamp < TTL_MS && Array.isArray(parsed.data)) {
            return await this.attachFavoriteFlags(parsed.data);
          }
        }
      } catch {}
    }

    const candidates: Map<string, RadioStation> = new Map();

    // 1. Existing local catalogue geolocated stations
    for (const s of this.catalogue.values()) {
      if (s.hasCoordinates !== false && isValidCoordinate(s.latitude, s.longitude)) {
        candidates.set(s.id, s);
      }
    }

    // 2. Fetch bounding box candidates from primary adapter
    const bounds = calculateBoundingBox(latitude, longitude, radiusKm);
    try {
      const bboxStations = await this.primaryAdapter.getStationsInBounds(bounds, 100);
      this.totalRecordsFetchedCounter += bboxStations.length;
      for (const s of bboxStations) {
        this.catalogue.set(s.id, s);
        candidates.set(s.id, s);
      }
    } catch (err) {
      console.warn('[fmX Repository] Nearby bbox query failed on primary adapter:', err);
    }

    // 3. Fetch from secondary adapter if available
    if (this.secondaryAdapter) {
      try {
        const secBbox = await this.secondaryAdapter.getStationsInBounds(bounds, 50);
        this.totalRecordsFetchedCounter += secBbox.length;
        for (const s of secBbox) {
          this.catalogue.set(s.id, s);
          candidates.set(s.id, s);
        }
      } catch {}
    }

    // 4. Exact Haversine distance calculation and sorting
    const candidateList = Array.from(candidates.values());
    const nearby = filterAndSortStationsByDistance(candidateList, latitude, longitude, radiusKm);
    const unique = this.deduplicateStations(nearby);

    // 5. Cache results
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: unique }));
    } catch {}

    return await this.attachFavoriteFlags(unique);
  }

  async getStationById(id: string): Promise<RadioStation | null> {
    if (this.catalogue.has(id)) {
      const cached = this.catalogue.get(id)!;
      const isFav = await localFavoritesStorage.isFavorite(id);
      return { ...cached, isFavorite: isFav };
    }

    try {
      const station = await this.primaryAdapter.getStationById(id);
      if (station) {
        this.catalogue.set(station.id, station);
        const isFav = await localFavoritesStorage.isFavorite(id);
        return { ...station, isFavorite: isFav };
      }
      return null;
    } catch {
      return null;
    }
  }

  async toggleFavorite(stationId: string): Promise<boolean> {
    return await localFavoritesStorage.toggleFavorite(stationId);
  }

  async isFavorite(stationId: string): Promise<boolean> {
    return await localFavoritesStorage.isFavorite(stationId);
  }

  async getFavorites(): Promise<RadioStation[]> {
    const favIds = await localFavoritesStorage.getFavorites();
    const result: RadioStation[] = [];

    for (const id of favIds) {
      const station = await this.getStationById(id);
      if (station) {
        result.push(station);
      }
    }

    return result;
  }

  async getSavedStations(): Promise<RadioStation[]> {
    return this.getFavorites();
  }

  /**
   * Resolves latest stream URL directly from directory endpoint for live stations if available.
   */
  async resolveStationStream(station: RadioStation): Promise<string> {
    // Secondary Provider stream resolution (Radio Garden 302 redirect tracking)
    if (
      (station.provider === 'radio-garden' || station.id.startsWith('rg_')) &&
      this.secondaryAdapter?.resolveStreamUrl
    ) {
      try {
        const resolved = await this.secondaryAdapter.resolveStreamUrl(station.sourceStationId || station.id);
        if (resolved) {
          station.streamUrl = resolved;
          station.urlResolved = resolved;
          this.catalogue.set(station.id, station);
          return resolved;
        }
      } catch {}
    }

    // Primary Provider stream resolution (Radio Browser /json/url/{uuid})
    if (
      this.primaryAdapter.resolveStreamUrl &&
      station.id &&
      !station.id.startsWith('hub_') &&
      !station.id.startsWith('fmx_') &&
      !station.id.startsWith('rg_')
    ) {
      try {
        const resolved = await this.primaryAdapter.resolveStreamUrl(station.id);
        if (resolved) {
          station.streamUrl = resolved;
          station.urlResolved = resolved;
          this.catalogue.set(station.id, station);
          return resolved;
        }
      } catch {}
    }
    return station.streamUrl;
  }

  async getStatesByCountry(country: string, limit = 100): Promise<Array<{ name: string; country: string; stationCount: number }>> {
    try {
      if ((this.primaryAdapter as any).getStatesByCountry) {
        return await (this.primaryAdapter as any).getStatesByCountry(country, limit);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStationsByCountryAndState(countryCode: string, state: string, limit = 50, offset = 0): Promise<RadioStation[]> {
    try {
      if ((this.primaryAdapter as any).getStationsByCountryAndState) {
        const stations = await (this.primaryAdapter as any).getStationsByCountryAndState(countryCode, state, limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getStationsByCity(countryCode: string, city: string, limit = 50, offset = 0): Promise<RadioStation[]> {
    try {
      if ((this.primaryAdapter as any).getStationsByCity) {
        const stations = await (this.primaryAdapter as any).getStationsByCity(countryCode, city, limit, offset);
        this.totalRecordsFetchedCounter += stations.length;
        for (const s of stations) {
          this.catalogue.set(s.id, s);
        }
        return await this.attachFavoriteFlags(stations);
      }
      return [];
    } catch {
      return [];
    }
  }

  async getRecentStations(): Promise<RadioStation[]> {
    const list = await localHistoryStorage.getRecentStations();
    return await this.attachFavoriteFlags(list);
  }

  async recordStationPlayed(station: RadioStation): Promise<void> {
    if (!station) return;
    this.catalogue.set(station.id, station);
    await localHistoryStorage.addRecentStation(station);
  }

  async clearRecentStations(): Promise<void> {
    await localHistoryStorage.clearRecentStations();
  }

  /**
   * Return verified distinct telemetry counts across directory and local catalogue.
   */
  public getCatalogueStats(
    selectedStation?: RadioStation | null
  ): StationCatalogueStats {
    const all = Array.from(this.catalogue.values());
    const geolocated = all.filter(
      (s) =>
        typeof s.latitude === 'number' &&
        typeof s.longitude === 'number' &&
        (Math.abs(s.latitude) > 0.001 || Math.abs(s.longitude) > 0.001)
    );

    return {
      totalRecordsFetched: this.totalRecordsFetchedCounter,
      uniqueStationsCount: all.length,
      geolocatedStationsCount: geolocated.length,
      selectedStationName: selectedStation ? selectedStation.name : null,
    };
  }
}

export const stationRepository = new StationRepository();
