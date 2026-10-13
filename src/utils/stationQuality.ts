import { RadioStation, StationQualityBadge } from '../types/station';

/**
 * Computes transparent, truthful quality badges for station presentation.
 * Never collapses multiple distinct verification signals into an ambiguous 'verified' boolean.
 */
export function computeStationQualityBadge(
  station: RadioStation,
  isTemporarilyFailing?: boolean
): StationQualityBadge {
  if (isTemporarilyFailing) {
    return 'TEMPORARILY UNAVAILABLE';
  }

  // Playback confirmed live in browser or target player
  if (station.playbackSucceeded || station.isStreamVerified) {
    return 'PLAYABLE';
  }

  // Missing or unconfirmed coordinates
  if (station.hasCoordinates === false || !station.isLocationVerified) {
    return 'LOCATION UNVERIFIED';
  }

  // Directory health check passed (lastcheckok === 1)
  if (station.lastCheckOk || station.directoryHealthPassed) {
    return 'AVAILABLE';
  }

  return 'UNVERIFIED';
}

/**
 * Returns formatted diagnostic telemetry for developers.
 */
export function getStationQualityDiagnostics(station: RadioStation): {
  directoryRecord: string;
  directoryHealth: string;
  streamReachable: string;
  playbackConfirmed: string;
  locationVerified: string;
  identityVerified: string;
} {
  return {
    directoryRecord: station.directoryRecordAvailable !== false ? 'AVAILABLE' : 'MISSING',
    directoryHealth: station.lastCheckOk ? 'HEALTHY (1)' : 'UNCHECKED / FAILED (0)',
    streamReachable: station.streamReachable === true ? 'HTTP 200' : station.streamReachable === false ? 'UNREACHABLE' : 'UNTESTED',
    playbackConfirmed: station.playbackSucceeded || station.isStreamVerified ? 'CONFIRMED' : 'UNCONFIRMED',
    locationVerified: station.isLocationVerified && station.hasCoordinates ? 'VERIFIED' : 'UNVERIFIED',
    identityVerified: station.isIdentityVerified ? 'VERIFIED' : 'COMMUNITY FEED',
  };
}
