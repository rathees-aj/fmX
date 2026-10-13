import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { RadioStation } from '../../types/station';
import { colors } from '../../theme/colors';
import { stationRepository } from '../../services/radio/stationRepository';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { formatStationLocation } from '../../utils/locationFormatter';
import { StationArtwork } from '../common/StationArtwork';

interface MyStationsScreenProps {
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
  selectedStation?: RadioStation | null;
  contentBottomPadding?: number;
}

export const MyStationsScreen: React.FC<MyStationsScreenProps> = ({
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
  selectedStation,
  contentBottomPadding,
}) => {
  const { currentStation, status, playStation, pause, resume } = useAudioPlayer();

  const [recentStations, setRecentStations] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecentStations = useCallback(async () => {
    setIsLoading(true);
    try {
      const recents = await stationRepository.getRecentStations();
      setRecentStations(recents);
    } catch (err) {
      console.warn('[fmX MyStationsScreen] Failed loading recent history:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecentStations();
  }, [loadRecentStations, currentStation?.id]);

  const handleClearHistory = async () => {
    await stationRepository.clearRecentStations();
    setRecentStations([]);
  };

  const handleTogglePlayback = (station: RadioStation) => {
    onSelectStation(station);
    if (currentStation?.id === station.id) {
      if (status === 'playing') {
        pause();
      } else if (status === 'paused') {
        resume();
      } else {
        playStation(station);
      }
    } else {
      playStation(station);
    }
  };

  const renderStationItem = ({ item }: { item: RadioStation }) => {
    const isCurrent = currentStation?.id === item.id;
    const isPlaying = isCurrent && status === 'playing';
    const isLoadingStation = isCurrent && status === 'loading';
    const isSelected = selectedStation?.id === item.id;
    const isFav = favoriteIds.has(item.id);

    const monogram =
      item.name
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join('') || 'FM';

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onSelectStation(item)}
        style={[
          styles.stationCard,
          isSelected && styles.stationCardSelected,
          isCurrent && styles.stationCardCurrent,
        ]}
      >
        <View style={styles.stationTop}>
          {/* Station Artwork Cover */}
          <StationArtwork station={item} size={44} />

          <View style={styles.stationInfo}>
            <View style={styles.titleRow}>
              <Text style={styles.stationName}>{item.name}</Text>
              {isPlaying && <WaveformIndicator status={status} barCount={3} height={14} />}
            </View>

            <Text style={styles.locationText}>{formatStationLocation(item)}</Text>

            <View style={styles.tagRow}>
              {item.languages?.[0] ? (
                <View style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{item.languages[0].toUpperCase()}</Text>
                </View>
              ) : null}
              {item.genres?.[0] ? (
                <View style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{item.genres[0].toUpperCase()}</Text>
                </View>
              ) : null}
              {item.bitrate ? (
                <Text style={styles.metaText}>{item.bitrate} kbps</Text>
              ) : null}
              <Text style={styles.metaText}>{item.codec || 'MP3'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggleFavorite(item.id)}
            style={styles.actionFavBtn}
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={[styles.favIcon, isFav && styles.favIconActive]}>
              {isFav ? '★' : '☆'}
            </Text>
            <Text style={styles.actionBtnLabel}>{isFav ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleTogglePlayback(item)}
            style={[
              styles.actionPlayBtn,
              isPlaying && styles.actionPlayBtnActive,
              isLoadingStation && styles.actionPlayBtnLoading,
            ]}
            accessibilityLabel={isPlaying ? 'Pause broadcast' : 'Tune in to station'}
          >
            {isLoadingStation ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={[styles.actionPlayText, { fontSize: 11 }]}>TUNING</Text>
              </View>
            ) : (
              <Text style={[styles.actionPlayText, isPlaying && styles.actionPlayTextActive]}>
                {isPlaying ? 'PAUSE' : 'TUNE IN'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerArea}>
        <View style={styles.headerTop}>
          <Text style={styles.screenHeading}>MY STATIONS</Text>
          {recentStations.length > 0 && (
            <TouchableOpacity
              onPress={handleClearHistory}
              style={styles.clearBtn}
              accessibilityLabel="Clear listening history"
            >
              <Text style={styles.clearBtnText}>CLEAR HISTORY</Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.screenSubheading}>
          Recently played stations stored locally on this device. No account or sign-in needed.
        </Text>
      </View>

      <View style={styles.statusBar}>
        <Text style={styles.statusCount}>
          {recentStations.length > 0
            ? `${recentStations.length} RECENT BROADCASTS`
            : 'NO RECENT HISTORY'}
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.white} />
          <Text style={styles.loadingText}>Loading listening history...</Text>
        </View>
      ) : (
        <FlatList
          data={recentStations}
          keyExtractor={(item) => item.id}
          renderItem={renderStationItem}
          contentContainerStyle={[
            styles.listContent,
            contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📻</Text>
              <Text style={styles.emptyTitle}>Your listening history is empty</Text>
              <Text style={styles.emptySubtitle}>
                Tune into any station in Explore, Countries, or Search to automatically build your
                personal rotation.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pureBlack,
  },
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  screenHeading: {
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1.2,
  },
  screenSubheading: {
    fontSize: 13,
    color: colors.silver,
    marginTop: 4,
    lineHeight: 18,
  },
  clearBtn: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 4,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statusCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Courier',
    fontSize: 13,
    color: colors.silver,
  },
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 90,
  },
  stationCard: {
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 6,
    padding: 14,
  },
  stationCardSelected: {
    borderColor: colors.white,
  },
  stationCardCurrent: {
    backgroundColor: '#1C1C1E',
    borderColor: colors.silver,
  },
  stationTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  monogramBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramBoxCurrent: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  monogramText: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: '900',
    color: colors.white,
  },
  monogramTextCurrent: {
    color: colors.pureBlack,
  },
  stationInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 22,
    flexWrap: 'wrap',
    flex: 1,
    minWidth: 0,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.silver,
    lineHeight: 18,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tagChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: colors.surfaceDark,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  tagChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.offWhite,
    letterSpacing: 0.5,
  },
  metaText: {
    fontSize: 11,
    color: colors.midGray,
    fontFamily: 'Courier',
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  actionFavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    minWidth: 70,
  },
  favIcon: {
    fontSize: 18,
    color: colors.midGray,
  },
  favIconActive: {
    color: colors.white,
  },
  actionBtnLabel: {
    fontSize: 12,
    color: colors.silver,
    fontWeight: '600',
  },
  actionPlayBtn: {
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 4,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPlayBtnActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  actionPlayBtnLoading: {
    backgroundColor: '#26262B',
    borderColor: colors.silver,
  },
  actionPlayText: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
  actionPlayTextActive: {
    color: colors.pureBlack,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 18,
  },
});
