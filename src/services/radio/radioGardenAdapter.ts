import { RadioStation, StationBoundingBox } from '../../types/station';
import { RadioDirectoryAdapter, StationQueryOptions } from './types';
import { getRegionForCountryCode } from '../../utils/regionMapping';
import { computeStationQualityBadge } from '../../utils/stationQuality';
import { streamHealthTracker } from '../audio/streamHealthTracker';

export interface RadioGardenPlace {
  id: string;
  title: string;
  country: string;
  geo: [number, number]; // GeoJSON format: [longitude, latitude]
  url: string;
  size: number;
}

export interface RadioGardenChannelRaw {
  id?: string;
  url?: string; // e.g. "/listen/kexp-90-3-fm/2m0QRgcW"
  title: string;
  subtitle?: string;
  website?: string;
  secure?: boolean;
  place?: {
    id: string;
    title: string;
  };
  country?: {
    id: string;
    title: string;
  };
  code?: string;
  stream?: string;
}

/**
 * EXPERIMENTAL & RESEARCH ADAPTER — Radio Garden (radio.garden)
 * 
 * NOTICE ON LICENSING & API RESTRICTIONS:
 * Radio Garden BV operates a proprietary directory without a documented public API.
 * The endpoints accessed here are reverse-engineered (/api/ara/...) and may be subject
 * to Cloudflare anti-bot mitigation (HTTP 403) and strict terms prohibiting commercial redistribution.
 * 
 * This adapter serves as an experimental secondary provider for research and comparison.
 * Radio Browser remains fmX's primary production-grade directory.
 */
export class RadioGardenAdapter implements RadioDirectoryAdapter {
  readonly name = 'RadioGardenAdapter (Experimental)';
  private baseUrl = 'https://radio.garden/api';
  private placeCache: Map<string, RadioGardenPlace> = new Map();
  private placesLoaded = false;
  public lastDiagnostics: {
    lastEndpoint?: string;
    lastStatus?: number;
    rateLimited?: boolean;
    error?: string | null;
  } = {};

  /**
   * Pre-fetches global places catalogue from /ara/content/places to enable coordinate lookups.
   */
  public async loadPlaces(): Promise<void> {
    if (this.placesLoaded) return;
    try {
      const res = await fetch(`${this.baseUrl}/ara/content/places`, {
        headers: { Accept: 'application/json' },
      });
      this.lastDiagnostics.lastEndpoint = '/ara/content/places';
      this.lastDiagnostics.lastStatus = res.status;

      if (!res.ok) {
        if (res.status === 403) {
          this.lastDiagnostics.rateLimited = true;
          this.lastDiagnostics.error = 'Cloudflare challenge / WAF rate limit encountered';
        }
        return;
      }

      const json = await res.json();
      const list: RadioGardenPlace[] = json?.data?.list || [];
      for (const p of list) {
        if (p.id) {
          this.placeCache.set(p.id, p);
        }
      }
      this.placesLoaded = true;
    } catch (err: any) {
      this.lastDiagnostics.error = err?.message || 'Failed loading Radio Garden places';
    }
  }

  /**
   * Normalizes a Radio Garden channel record into the canonical RadioStation model.
   * Crucially resolves:
   * 1. Place ID vs Channel ID separation (never conflates place with station).
   * 2. GeoJSON [lng, lat] coordinate order conversion to { latitude: lat, longitude: lng }.
   */
  public normalizeChannel(
    raw: RadioGardenChannelRaw,
    resolvedStreamUrl?: string
  ): RadioStation | null {
    if (!raw || !raw.title) return null;

    // Extract channel ID from url slug or direct id property
    let channelId = raw.id || '';
    if (!channelId && raw.url) {
      const parts = raw.url.split('/');
      channelId = parts[parts.length - 1];
    }
    if (!channelId) return null;

    const placeId = raw.place?.id;
    const place = placeId ? this.placeCache.get(placeId) : undefined;

    // Coordinate conversion: Radio Garden uses GeoJSON [longitude, latitude]
    let latitude = 0;
    let longitude = 0;
    let hasCoords = false;

    if (place?.geo && Array.isArray(place.geo) && place.geo.length === 2) {
      const [lng, lat] = place.geo;
      if (
        typeof lat === 'number' &&
        typeof lng === 'number' &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001)
      ) {
        latitude = Number(lat.toFixed(4));
        longitude = Number(lng.toFixed(4));
        hasCoords = true;
      }
    }

    const countryName = raw.country?.title || place?.country || 'Global';
    const countryCode = (raw.code || 'GL').toUpperCase().substring(0, 2);
    const cityName = raw.place?.title || place?.title;

    // Temporary placeholder URL until stream resolution via /ara/content/listen/{channelId}/channel.mp3
    const streamUrl = resolvedStreamUrl || `${this.baseUrl}/ara/content/listen/${channelId}/channel.mp3`;

    const station: RadioStation = {
      id: `rg_${channelId}`,
      provider: 'radio-garden',
      sourceStationId: channelId,
      sourcePlaceId: placeId,
      coordinateSource: 'radio-garden:geo[lng,lat]',
      name: raw.title.trim(),
      city: cityName,
      country: countryName,
      countryCode,
      region: getRegionForCountryCode(countryCode),
      latitude,
      longitude,
      hasCoordinates: hasCoords,
      genres: ['Radio'],
      streamUrl,
      urlResolved: resolvedStreamUrl,
      homepage: raw.website,
      codec: 'MP3',
      directoryRecordAvailable: true,
      directoryHealthPassed: true,
      isLocationVerified: hasCoords,
      isIdentityVerified: true,
      isStreamVerified: Boolean(resolvedStreamUrl),
    };

    station.qualityBadge = computeStationQualityBadge(station);
    return station;
  }

  /**
   * Search stations via /api/search?q={query}
   */
  async searchStations(options: StationQueryOptions | string): Promise<RadioStation[]> {
    const query = typeof options === 'string' ? options.trim() : options.query?.trim() || '';
    if (!query) return [];

    await this.loadPlaces();

    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query.toLowerCase())}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      this.lastDiagnostics.lastEndpoint = `/search?q=${query}`;
      this.lastDiagnostics.lastStatus = res.status;

      if (!res.ok) {
        if (res.status === 403) {
          this.lastDiagnostics.rateLimited = true;
          this.lastDiagnostics.error = 'Radio Garden rate limit / WAF protection triggered';
        }
        return [];
      }

      const json = await res.json();
      const hits: any[] = json?.hits?.hits || [];
      const stations: RadioStation[] = [];

      for (const hit of hits) {
        const source = hit?._source;
        if (source?.type === 'channel' || source?.page?.type === 'channel') {
          const rawChannel: RadioGardenChannelRaw = {
            ...source.page,
            code: source.code,
          };
          const normalized = this.normalizeChannel(rawChannel);
          if (normalized) {
            stations.push(normalized);
          }
        }
      }

      return stations;
    } catch (err: any) {
      this.lastDiagnostics.error = err?.message;
      return [];
    }
  }

  /**
   * Resolves actual live stream URL through Radio Garden's HTTP 302 redirect endpoint:
   * /ara/content/listen/{channelId}/channel.mp3
   */
  async resolveStreamUrl(stationIdOrChannelId: string): Promise<string | null> {
    const channelId = stationIdOrChannelId.replace(/^rg_/, '');
    const endpoint = `${this.baseUrl}/ara/content/listen/${encodeURIComponent(channelId)}/channel.mp3`;

    try {
      const res = await fetch(endpoint, {
        method: 'HEAD',
        redirect: 'manual', // Intercept 302 redirect header
      });

      if (res.status === 301 || res.status === 302) {
        const location = res.headers.get('Location') || res.headers.get('location');
        if (location && streamHealthTracker.isValidStreamUrl(location)) {
          return location.trim();
        }
      }

      // If redirect was followed automatically
      if (res.ok && res.url && streamHealthTracker.isValidStreamUrl(res.url)) {
        return res.url.trim();
      }

      return null;
    } catch {
      return null;
    }
  }

  async getCuratedStations(limit = 30): Promise<RadioStation[]> {
    await this.loadPlaces();
    // Return top places stations if available
    return [];
  }

  async getStationsInBounds(bounds: StationBoundingBox, limit = 30): Promise<RadioStation[]> {
    await this.loadPlaces();
    return [];
  }

  async getStationById(id: string): Promise<RadioStation | null> {
    const channelId = id.replace(/^rg_/, '');
    await this.loadPlaces();

    try {
      const res = await fetch(`${this.baseUrl}/ara/content/channel/${encodeURIComponent(channelId)}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return null;

      const json = await res.json();
      const channelData = json?.data;
      if (!channelData) return null;

      const resolvedUrl = await this.resolveStreamUrl(channelId);
      return this.normalizeChannel(channelData, resolvedUrl || undefined);
    } catch {
      return null;
    }
  }
}
