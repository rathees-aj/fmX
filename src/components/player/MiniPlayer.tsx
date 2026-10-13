import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { colors } from '../../theme/colors';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { RadioStation } from '../../types/station';
import { formatStationLocation } from '../../utils/locationFormatter';
import { StationArtwork } from '../common/StationArtwork';

interface MiniPlayerProps {
  onExpandStation?: (station: RadioStation) => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({ onExpandStation }) => {
  const {
    currentStation,
    status,
    errorMessage,
    isMuted,
    togglePlayPause,
    toggleMute,
    stop,
  } = useAudioPlayer();

  if (!currentStation && status === 'idle') {
    return null;
  }

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const isError = status === 'error';

  const monogram = currentStation?.name
    ? currentStation.name
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('') || 'FM'
    : 'FM';

  return (
    <View style={styles.container}>
      {/* 1px Hairline Active Status Indicator */}
      <View
        style={[
          styles.statusBar,
          isPlaying && styles.statusBarActive,
          isLoading && styles.statusBarLoading,
          isError && styles.statusBarError,
        ]}
      />

      <View style={styles.contentRow}>
        {/* Tapping expands station details */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => currentStation && onExpandStation?.(currentStation)}
          style={styles.infoArea}
        >
          {/* Station Artwork Cover */}
          {currentStation ? (
            <StationArtwork station={currentStation} size={38} />
          ) : null}

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.stationName} numberOfLines={1}>
                {currentStation?.name || 'Tuning Frequency...'}
              </Text>
              {isPlaying && <WaveformIndicator status={status} barCount={3} height={10} />}
            </View>

            <Text style={styles.stationLocation} numberOfLines={1}>
              {isError
                ? errorMessage || 'SIGNAL INTERRUPTED // RETRY'
                : `${formatStationLocation(currentStation)} • ${currentStation?.frequency || 'ONLINE'}`}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Tactical Controls */}
        <View style={styles.controlsArea}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={toggleMute}
            style={styles.muteButton}
            accessibilityLabel="Toggle audio mute"
          >
            <Text style={[styles.muteText, isMuted && styles.muteTextMuted]}>
              {isMuted ? 'MUTED' : 'VOL'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={togglePlayPause}
            style={[styles.playButton, isPlaying && styles.playButtonActive]}
            accessibilityLabel={isPlaying ? 'Pause broadcast' : 'Play broadcast'}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={[styles.playButtonText, isPlaying && styles.playButtonTextActive]}>
                {isPlaying ? 'PAUSE' : 'PLAY'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={stop}
            style={styles.dismissBtn}
            accessibilityLabel="Stop broadcast"
          >
            <Text style={styles.dismissIcon}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.charcoal,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    zIndex: 25,
  },
  statusBar: {
    height: 1.5,
    backgroundColor: colors.borderSubtle,
  },
  statusBarActive: {
    backgroundColor: colors.white,
  },
  statusBarLoading: {
    backgroundColor: colors.silver,
  },
  statusBarError: {
    backgroundColor: colors.midGray,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  infoArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monogramBox: {
    width: 36,
    height: 36,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '900',
    color: colors.white,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: -0.2,
    flex: 1,
  },
  stationLocation: {
    fontSize: 11,
    color: colors.silver,
    letterSpacing: 0.2,
  },
  controlsArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  muteButton: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
    backgroundColor: colors.surfaceDark,
  },
  muteText: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.6,
  },
  muteTextMuted: {
    color: colors.midGray,
    textDecorationLine: 'line-through',
  },
  playButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 2,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonActive: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
  },
  playButtonText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '800',
    color: colors.pureBlack,
    letterSpacing: 0.8,
  },
  playButtonTextActive: {
    color: colors.white,
  },
  dismissBtn: {
    padding: 6,
  },
  dismissIcon: {
    color: colors.silver,
    fontSize: 12,
  },
});
