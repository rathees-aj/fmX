export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export type StationQualityBadge =
  | 'AVAILABLE'
  | 'PLAYABLE'
  | 'UNVERIFIED'
  | 'LOCATION UNVERIFIED'
  | 'TEMPORARILY UNAVAILABLE';

export interface RadioStation {
  /** Stable primary identifier (preserves provider stationuuid whenever available) */
  id: string;
  /** Primary station or broadcaster name (preserves source title with display whitespace normalization) */
  name: string;
  tagline?: string;

  /** Geographic and administrative location */
  city?: string;
  state?: string;
  country: string;
  countryCode: string;
  iso_3166_2?: string;

  /** Multi-language metadata */
  language?: string;
  languages?: string[];
  languageCodes?: string[];

  /** Derived geographic continent grouping strictly derived from country code */
  region?: 'ASIA' | 'EUROPE' | 'AFRICA' | 'NORTH_AMERICA' | 'SOUTH_AMERICA' | 'OCEANIA' | 'OTHER';

  /** Geographic coordinates & proximity */
  latitude: number;
  longitude: number;
  hasCoordinates?: boolean;
  distanceKm?: number;

  /** Over-the-air broadcast frequency if present in metadata (never bitrates) */
  frequency?: string; // e.g., "90.3 FM", "101.4 FM"

  /** Musical and thematic tags */
  genres: string[];

  /** Stream endpoints */
  streamUrl: string;
  urlResolved?: string;
  bitrate?: number; // kbps, e.g. 128
  codec?: string; // e.g. 'MP3', 'AAC', 'HLS'
  hls?: boolean;

  /** Broadcaster web presence */
  homepage?: string;
  favicon?: string;

  /** Provenance and source directory metadata */
  provider?: string; // e.g. 'radio-browser', 'radio-garden', 'verified-catalogue'
  sourceStationId?: string; // original provider station ID (e.g. RG channel id or RB uuid)
  sourcePlaceId?: string; // original provider place/city ID (e.g. RG place id PPM2Rql0)
  coordinateSource?: string; // e.g. 'radio-garden:geo[lng,lat]', 'radio-browser:geo_lat/geo_long'
  changeuuid?: string;
  votes?: number;
  clickCount?: number;

  /** Geographic verification & provenance */
  locationConfidence?: LocationConfidence;
  coordinateProvenance?: CoordinateProvenance;
  locationType?: LocationType;
  locationDisclaimer?: string;
  verifiedAddress?: string;

  /** Audio identity verification status */
  audioIdentityStatus?: AudioIdentityStatus;

  /** Ambiguity flags */
  isAmbiguous?: boolean;
  ambiguityReason?: string;

  /** Distinct Three-Tier Verification Model */
  metadataVerified?: boolean;
  streamPlayable?: boolean;
  audioIdentityVerified?: boolean;

  /** Quality and Health Model */
  lastCheckOk?: boolean;
  lastCheckTime?: string;
  lastCheckOkTime?: string;
  directoryRecordAvailable?: boolean;
  directoryHealthPassed?: boolean;
  streamReachable?: boolean | null;
  playbackSucceeded?: boolean | null;
  isLocationVerified?: boolean;
  isIdentityVerified?: boolean;
  isStreamVerified?: boolean;
  verificationNotes?: string;
  qualityBadge?: StationQualityBadge;

  /** Artwork & Cover Metadata */
  artworkUrl?: string;
  artworkSource?: ArtworkSourceType;
  artworkIsOfficial?: boolean;

  /** User interaction flags */
  isFavorite?: boolean;
}

export type ArtworkSourceType =
  | 'verified_broadcaster'
  | 'directory_favicon'
  | 'fmx_generated_fallback'
  | 'generic_fallback';

export interface StationArtwork {
  uri?: string;
  sourceType: ArtworkSourceType;
  isOfficial: boolean;
  attribution?: string;
  isFallback: boolean;
}

export type LocationConfidence =
  | 'verified_broadcaster_address'
  | 'provider_reported_coordinates'
  | 'city_or_region_only'
  | 'unverified'
  | 'conflicting_location';

export type CoordinateProvenance =
  | 'provider_directory'
  | 'broadcaster_metadata'
  | 'city_centroid'
  | 'none';

export type LocationType =
  | 'studio'
  | 'transmitter'
  | 'headquarters'
  | 'city_centroid'
  | 'unknown';

export type AudioIdentityStatus =
  | 'verified'
  | 'audio_identity_unverified'
  | 'stream_unavailable';

export interface StationBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}
