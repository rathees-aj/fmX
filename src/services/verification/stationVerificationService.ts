import {
  RadioStation,
  LocationConfidence,
  CoordinateProvenance,
  LocationType,
  AudioIdentityStatus,
} from '../../types/station';
import { isValidCoordinate } from '../../utils/geoDistance';

export interface StationVerificationSummary {
  locationConfidence: LocationConfidence;
  coordinateProvenance: CoordinateProvenance;
  locationType: LocationType;
  locationLabel: string;
  locationDisclaimer?: string;
  verifiedAddress?: string;

  audioIdentityStatus: AudioIdentityStatus;
  audioIdentityLabel: string;
  audioDisclaimer?: string;

  /** Distinct Three-Tier Verification Flags */
  metadataVerified: boolean;
  streamPlayable: boolean;
  audioIdentityVerified: boolean;

  isAmbiguous: boolean;
  ambiguityReason?: string;
}

/**
 * Station Verification Service.
 * Evaluates both geographic confidence and audio identity verification independently.
 * Free, open-source, and does not depend on any Google Maps or paid APIs.
 */
class StationVerificationService {
  /**
   * Enriches and verifies a radio station based on broadcaster metadata and directory health.
   */
  async verifyStation(station: RadioStation): Promise<RadioStation> {
    let locationConfidence: LocationConfidence = station.locationConfidence || 'unverified';
    let coordinateProvenance: CoordinateProvenance = station.coordinateProvenance || 'provider_directory';
    let locationType: LocationType = station.locationType || 'unknown';
    const locationDisclaimer: string | undefined = station.locationDisclaimer;
    const verifiedAddress: string | undefined = station.verifiedAddress;
    const isAmbiguous = Boolean(station.isAmbiguous);
    const ambiguityReason = station.ambiguityReason;

    // Check if station has verified catalogue metadata or directory coordinates
    if (station.isLocationVerified && station.provider === 'verified-catalogue') {
      locationConfidence = 'verified_broadcaster_address';
      coordinateProvenance = 'broadcaster_metadata';
      locationType = station.locationType || 'studio';
    } else if (isValidCoordinate(station.latitude, station.longitude)) {
      locationConfidence = 'provider_reported_coordinates';
      coordinateProvenance = station.coordinateSource ? 'provider_directory' : 'provider_directory';
    }

    // Three-tier verification evaluation
    const metadataVerified = Boolean(
      station.metadataVerified !== undefined
        ? station.metadataVerified
        : (station.homepage && station.countryCode && station.name && station.provider === 'verified-catalogue')
    );

    const streamPlayable = Boolean(
      station.streamPlayable !== undefined
        ? station.streamPlayable
        : (station.playbackSucceeded || station.lastCheckOk || station.streamReachable)
    );

    const audioIdentityVerified = Boolean(
      station.audioIdentityVerified !== undefined
        ? station.audioIdentityVerified
        : (station.isIdentityVerified && station.provider === 'verified-catalogue' && streamPlayable)
    );

    // Audio Identity Status
    let audioIdentityStatus: AudioIdentityStatus = station.audioIdentityStatus || 'audio_identity_unverified';

    if (station.playbackSucceeded === false || station.streamReachable === false) {
      audioIdentityStatus = 'stream_unavailable';
    } else if (audioIdentityVerified) {
      audioIdentityStatus = 'verified';
    } else {
      audioIdentityStatus = 'audio_identity_unverified';
    }

    return {
      ...station,
      locationConfidence,
      coordinateProvenance,
      locationType,
      locationDisclaimer,
      verifiedAddress,
      audioIdentityStatus,
      metadataVerified,
      streamPlayable,
      audioIdentityVerified,
      isAmbiguous,
      ambiguityReason,
    };
  }

  /**
   * Generates display badges and labels for UI components.
   */
  getVerificationSummary(station: RadioStation): StationVerificationSummary {
    const conf = station.locationConfidence || (
      isValidCoordinate(station.latitude, station.longitude)
        ? 'provider_reported_coordinates'
        : 'unverified'
    );

    let locationLabel = 'LOCATION UNVERIFIED';
    switch (conf) {
      case 'verified_broadcaster_address':
        locationLabel = 'LOCATION VERIFIED';
        break;
      case 'provider_reported_coordinates':
        locationLabel = 'PROVIDER COORDS';
        break;
      case 'city_or_region_only':
        locationLabel = 'CITY CENTROID';
        break;
      case 'conflicting_location':
        locationLabel = 'LOCATION CONFLICT';
        break;
      case 'unverified':
      default:
        locationLabel = 'LOCATION UNVERIFIED';
        break;
    }

    const metadataVerified = Boolean(
      station.metadataVerified !== undefined
        ? station.metadataVerified
        : (station.homepage && station.countryCode && station.name && station.provider === 'verified-catalogue')
    );

    const streamPlayable = Boolean(
      station.streamPlayable !== undefined
        ? station.streamPlayable
        : (station.playbackSucceeded || station.lastCheckOk || station.streamReachable)
    );

    const audioIdentityVerified = Boolean(
      station.audioIdentityVerified !== undefined
        ? station.audioIdentityVerified
        : (station.isIdentityVerified && station.provider === 'verified-catalogue' && streamPlayable)
    );

    let audioIdentityStatus = station.audioIdentityStatus || 'audio_identity_unverified';
    if (station.playbackSucceeded === false || station.streamReachable === false) {
      audioIdentityStatus = 'stream_unavailable';
    } else if (audioIdentityVerified) {
      audioIdentityStatus = 'verified';
    }

    let audioIdentityLabel = 'AUDIO IDENTITY UNVERIFIED';
    let audioDisclaimer: string | undefined;

    switch (audioIdentityStatus) {
      case 'verified':
        audioIdentityLabel = 'AUDIO IDENTITY VERIFIED';
        audioDisclaimer = 'Official broadcaster transmission stream independently confirmed.';
        break;
      case 'stream_unavailable':
        audioIdentityLabel = 'STREAM UNAVAILABLE';
        audioDisclaimer = 'Stream endpoint unreachable or codec unsupported.';
        break;
      case 'audio_identity_unverified':
      default:
        audioIdentityLabel = 'AUDIO IDENTITY UNVERIFIED';
        audioDisclaimer = 'Stream is active, but broadcast identity has not been independently fingerprinted.';
        break;
    }

    return {
      locationConfidence: conf,
      coordinateProvenance: station.coordinateProvenance || 'provider_directory',
      locationType: station.locationType || 'unknown',
      locationLabel,
      locationDisclaimer: station.locationDisclaimer,
      verifiedAddress: station.verifiedAddress,

      audioIdentityStatus,
      audioIdentityLabel,
      audioDisclaimer,

      metadataVerified,
      streamPlayable,
      audioIdentityVerified,

      isAmbiguous: Boolean(station.isAmbiguous),
      ambiguityReason: station.ambiguityReason,
    };
  }
}

export const stationVerificationService = new StationVerificationService();
