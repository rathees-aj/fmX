import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { RadioStation } from '../../types/station';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { colors } from '../../theme/colors';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { formatStationLocation } from '../../utils/locationFormatter';
import { stationVerificationService } from '../../services/verification/stationVerificationService';
import { StationArtwork } from '../common/StationArtwork';

interface StationCardProps {
  station: RadioStation;
  onClose: () => void;
  onToggleFavorite: (stationId: string) => void;
  isFavorite: boolean;
  onFindSimilar?: (station: RadioStation) => void;
}

export const StationCard: React.FC<StationCardProps> = ({
  station,
  onClose,
  onToggleFavorite,
  isFavorite,
  onFindSimilar,
}) => {
  const { currentStation, status, errorMessage, playStation, pause, resume } = useAudioPlayer();
  const verification = stationVerificationService.getVerificationSummary(station);

  const isCurrentStation = currentStation?.id === station.id;
  const isPlaying = isCurrentStation && status === 'playing';
  const isLoading = isCurrentStation && status === 'loading';
  const isError = isCurrentStation && status === 'error';

  const handlePlaybackAction = () => {
    if (isPlaying) {
      pause();
    } else if (isCurrentStation && status === 'paused') {
      resume();
    } else {
      playStation(station);
    }
  };

  const handleOpenWebsite = () => {
    if (station.homepage) {
      Linking.openURL(station.homepage).catch(() => {});
    }
  };

  const monogram = station.name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'FM';

  return (
    <View style={styles.card}>
      {/* Top Header Row: Status, Coordinates & Dismiss */}
      <View style={styles.topRow}>
        <View style={styles.statusGroup}>
          <View
            style={[
              styles.statusLed,
              isPlaying && styles.statusLedActive,
              isLoading && styles.statusLedLoading,
              isError && styles.statusLedError,
            ]}
          />
          <Text style={[styles.statusLabel, isError && styles.statusLabelError]}>
            {isPlaying ? 'ON AIR' : isLoading ? 'TUNING...' : isError ? 'FEED OFFLINE' : 'LIVE FREQUENCY'}
          </Text>
          <Text style={styles.coordLabel}>
            {station.hasCoordinates !== false &&
            typeof station.latitude === 'number' &&
            typeof station.longitude === 'number' &&
            !isNaN(station.latitude) &&
            !isNaN(station.longitude) &&
            (Math.abs(station.latitude) > 0.001 || Math.abs(station.longitude) > 0.001)
              ? `${Math.abs(station.latitude).toFixed(1)}°${station.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(station.longitude).toFixed(1)}°${station.longitude >= 0 ? 'E' : 'W'}`
              : 'DIRECT BROADCAST'}
          </Text>
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggleFavorite(station.id)}
            style={styles.actionIconBtn}
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Save station'}
          >
            <Text style={[styles.favIcon, isFavorite && styles.favIconActive]}>
              {isFavorite ? '★' : '☆'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onClose}
            style={styles.actionIconBtn}
            accessibilityLabel="Close station card"
          >
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body: Monogram Artwork + Info + Play Action */}
      <View style={styles.mainContent}>
        {/* Station Artwork Cover */}
        <StationArtwork station={station} size={68} showBadge />

        {/* Station Details */}
        <View style={styles.detailsColumn}>
          <View style={styles.titleRow}>
            <Text style={styles.stationName}>
              {station.name}
            </Text>
            {isPlaying && <WaveformIndicator status={status} barCount={3} height={14} />}
          </View>

          <Text style={styles.locationText}>
            {formatStationLocation(station)}
          </Text>

          {/* Frequency, Language & Genre Metadata */}
          <View style={styles.metaRow}>
            {station.frequency ? (
              <Text style={styles.freqTag}>{station.frequency}</Text>
            ) : null}
            {station.languages?.[0] ? (
              <Text style={styles.genreTag}>
                {station.languages[0].toUpperCase()}
              </Text>
            ) : null}
            <Text style={styles.genreTag}>
              {station.genres[0] || 'GENERAL'}
            </Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.codecText}>
              {station.bitrate ? `${station.bitrate}K` : '128K'} {station.codec || 'MP3'}
            </Text>
          </View>
        </View>

        {/* Playback Button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={handlePlaybackAction}
          style={[
            styles.playBtn,
            isPlaying && styles.playBtnActive,
            isLoading && styles.playBtnLoading,
            isError && styles.playBtnError,
          ]}
          accessibilityLabel={isPlaying ? 'Pause broadcast' : 'Tune into station'}
        >
          {isLoading ? (
            <View style={styles.tuningRow}>
              <ActivityIndicator size="small" color={colors.pureBlack} />
              <Text style={styles.playBtnText}>TUNING</Text>
            </View>
          ) : (
            <Text style={[styles.playBtnText, isPlaying && styles.playBtnTextActive, isError && styles.playBtnTextError]}>
              {isPlaying ? 'PAUSE' : isError ? 'RETRY' : 'TUNE IN'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Station Identity & Location Verification Provenance Panel */}
      <View style={styles.provenancePanel}>
        <View style={styles.badgeRow}>
          {/* Metadata Verified Badge */}
          <View
            style={[
              styles.confidenceBadge,
              verification.metadataVerified && styles.confidenceBadgeVerified,
            ]}
          >
            <Text
              style={[
                styles.confidenceBadgeText,
                verification.metadataVerified && styles.confidenceBadgeTextVerified,
              ]}
            >
              {verification.metadataVerified ? 'METADATA VERIFIED' : 'METADATA UNVERIFIED'}
            </Text>
          </View>

          {/* Stream Playable Badge */}
          <View
            style={[
              styles.confidenceBadge,
              verification.streamPlayable && styles.confidenceBadgeVerified,
              verification.audioIdentityStatus === 'stream_unavailable' && styles.confidenceBadgeConflict,
            ]}
          >
            <Text
              style={[
                styles.confidenceBadgeText,
                verification.streamPlayable && styles.confidenceBadgeTextVerified,
                verification.audioIdentityStatus === 'stream_unavailable' && styles.confidenceBadgeTextConflict,
              ]}
            >
              {verification.audioIdentityStatus === 'stream_unavailable'
                ? 'STREAM OFFLINE'
                : verification.streamPlayable
                ? 'STREAM PLAYABLE'
                : 'STREAM UNTESTED'}
            </Text>
          </View>

          {/* Audio Identity Status Badge */}
          <View
            style={[
              styles.confidenceBadge,
              verification.audioIdentityVerified && styles.confidenceBadgeVerified,
              verification.audioIdentityStatus === 'audio_identity_unverified' && styles.confidenceBadgeCity,
            ]}
          >
            <Text
              style={[
                styles.confidenceBadgeText,
                verification.audioIdentityVerified && styles.confidenceBadgeTextVerified,
              ]}
            >
              {verification.audioIdentityLabel}
            </Text>
          </View>

          {/* Facility Type (Studio / Transmitter / HQ) */}
          {verification.locationType && verification.locationType !== 'unknown' && (
            <View style={styles.facilityPill}>
              <Text style={styles.facilityPillText}>
                {verification.locationType.toUpperCase()}
              </Text>
            </View>
          )}
        </View>

        {/* Verified Facility Address */}
        {verification.verifiedAddress ? (
          <View style={styles.addressRow}>
            <Text style={styles.addressLabel}>FACILITY:</Text>
            <Text style={styles.addressValue} numberOfLines={2}>
              {verification.verifiedAddress}
            </Text>
          </View>
        ) : null}

        {/* Studio vs Transmitter Disclaimer */}
        {verification.locationDisclaimer ? (
          <Text style={styles.provenanceDisclaimer}>
            {verification.locationDisclaimer}
          </Text>
        ) : null}

        {/* Provider and Coordinate Source Provenance */}
        <View style={styles.providerMetaRow}>
          <Text style={styles.providerMetaText}>
            PROVIDER: {(station.provider || 'radio-browser').toUpperCase()}
          </Text>
          <Text style={styles.providerMetaDot}>·</Text>
          <Text style={styles.providerMetaText}>
            PROVENANCE: {(station.coordinateProvenance || station.coordinateSource || 'provider_directory').toUpperCase()}
          </Text>
        </View>


        {/* Ambiguity Alert */}
        {verification.isAmbiguous && verification.ambiguityReason && (
          <View style={styles.ambiguityAlert}>
            <Text style={styles.ambiguityAlertText}>
              [!] {verification.ambiguityReason}
            </Text>
          </View>
        )}
      </View>

      {/* Stream Failure Diagnostics & Recovery Panel */}
      {isError && (
        <View style={styles.errorBanner}>
          <View style={styles.errorHeader}>
            <Text style={styles.errorIcon}>[!]</Text>
            <Text style={styles.errorTitle}>STREAM RECEPTION ERROR</Text>
          </View>
          <Text style={styles.errorDescription}>
            {errorMessage || 'Station broadcast endpoint unreachable or codec unsupported.'}
          </Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => playStation(station)}
              style={styles.retryBtn}
            >
              <Text style={styles.retryBtnText}>↻ RETRY TUNE-IN</Text>
            </TouchableOpacity>

            {station.homepage ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={handleOpenWebsite}
                style={styles.websiteBtn}
              >
                <Text style={styles.websiteBtnText}>WEBSITE ↗</Text>
              </TouchableOpacity>
            ) : null}

            {onFindSimilar ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onFindSimilar(station)}
                style={styles.similarBtn}
              >
                <Text style={styles.similarBtnText}>FIND SIMILAR</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.charcoal,
    borderColor: colors.borderMedium,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLed: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.midGray,
  },
  statusLedActive: {
    backgroundColor: colors.white,
  },
  statusLedLoading: {
    backgroundColor: colors.silver,
  },
  statusLedError: {
    backgroundColor: colors.midGray,
    borderWidth: 1,
    borderColor: colors.lightSilver,
  },
  statusLabel: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
  statusLabelError: {
    color: colors.lightSilver,
  },
  coordLabel: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: colors.midGray,
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionIconBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favIcon: {
    fontSize: 20,
    color: colors.silver,
  },
  favIconActive: {
    color: colors.white,
  },
  closeIcon: {
    fontSize: 16,
    color: colors.silver,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  monogramBox: {
    width: 48,
    height: 48,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: 'Courier',
    fontSize: 15,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 1,
  },
  detailsColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 23,
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 13,
    color: colors.offWhite,
    lineHeight: 18,
    fontWeight: '500',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  freqTag: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    backgroundColor: colors.surfaceDark,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
  },
  genreTag: {
    fontSize: 12,
    color: colors.lightSilver,
    textTransform: 'uppercase',
  },
  metaDot: {
    fontSize: 12,
    color: colors.midGray,
  },
  codecText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: colors.midGray,
  },
  playBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    minHeight: 44,
    minWidth: 80,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnActive: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  playBtnText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '800',
    color: colors.pureBlack,
    letterSpacing: 0.8,
  },
  playBtnTextActive: {
    color: colors.white,
  },
  playBtnError: {
    backgroundColor: colors.graphite,
    borderWidth: 1,
    borderColor: colors.midGray,
  },
  playBtnLoading: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  tuningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtnTextError: {
    color: colors.lightSilver,
  },
  errorBanner: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 2,
    padding: 8,
    gap: 6,
    marginTop: 4,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorIcon: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  errorTitle: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.8,
  },
  errorDescription: {
    fontSize: 11,
    color: colors.silver,
    lineHeight: 15,
  },
  errorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  retryBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
  },
  retryBtnText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.pureBlack,
    letterSpacing: 0.6,
  },
  websiteBtn: {
    backgroundColor: colors.graphite,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
  },
  websiteBtnText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.lightSilver,
    letterSpacing: 0.5,
  },
  similarBtn: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
  },
  similarBtnText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.5,
  },
  provenancePanel: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
    padding: 8,
    gap: 5,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  confidenceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.graphite,
    borderRadius: 2,
  },
  confidenceBadgeVerified: {
    backgroundColor: '#1E291E',
    borderColor: '#4A6B4A',
  },
  confidenceBadgeConflict: {
    backgroundColor: '#2A1A1A',
    borderColor: '#7A3A3A',
  },
  confidenceBadgeCity: {
    backgroundColor: colors.charcoal,
    borderColor: colors.borderMedium,
  },
  confidenceBadgeText: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.6,
  },
  confidenceBadgeTextVerified: {
    color: '#D4E8D4',
  },
  confidenceBadgeTextConflict: {
    color: '#F4D4D4',
  },
  facilityPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.charcoal,
    borderRadius: 2,
  },
  facilityPillText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.midGray,
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 2,
  },
  addressLabel: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '700',
    color: colors.midGray,
    letterSpacing: 0.5,
  },
  addressValue: {
    flex: 1,
    fontSize: 9,
    color: colors.lightSilver,
    lineHeight: 12,
  },
  provenanceDisclaimer: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.midGray,
    lineHeight: 11,
    marginTop: 1,
  },
  attributionRow: {
    marginTop: 2,
    alignSelf: 'flex-end',
  },
  attributionText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.silver,
    letterSpacing: 0.5,
  },
  ambiguityAlert: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    padding: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  ambiguityAlertText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.lightSilver,
  },
  providerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  providerMetaText: {
    fontFamily: 'Courier',
    fontSize: 8,
    color: colors.midGray,
    letterSpacing: 0.5,
  },
  providerMetaDot: {
    fontSize: 8,
    color: colors.graphite,
  },
});
