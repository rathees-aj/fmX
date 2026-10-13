import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { RadioStation } from '../../types/station';
import { colors } from '../../theme/colors';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { formatStationLocation } from '../../utils/locationFormatter';
import { StationArtwork } from '../common/StationArtwork';

interface StationListViewProps {
  stations: RadioStation[];
  selectedStation?: RadioStation | null;
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
  activeFilter: string;
  isLoadingDirectory?: boolean;
}

export const StationListView: React.FC<StationListViewProps> = ({
  stations,
  selectedStation,
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
  activeFilter,
  isLoadingDirectory = false,
}) => {
  const { currentStation, status, playStation, pause, resume } = useAudioPlayer();

  const renderStationItem = ({ item }: { item: RadioStation }) => {
    const isSelected = selectedStation?.id === item.id;
    const isCurrent = currentStation?.id === item.id;
    const isPlaying = isCurrent && status === 'playing';
    const isLoading = isCurrent && status === 'loading';
    const isError = isCurrent && status === 'error';
    const isPaused = isCurrent && status === 'paused';
    const isFav = favoriteIds.has(item.id);

    const monogram = item.name
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
          styles.itemRow,
          isSelected && styles.itemRowSelected,
          isCurrent && styles.itemRowCurrent,
        ]}
      >
        {/* Station Artwork Cover */}
        <StationArtwork station={item} size={44} />

        {/* Station Details */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.stationTitle}>
              {item.name}
            </Text>
            {isSelected && (
              <View style={styles.selectedPill}>
                <Text style={styles.selectedPillText}>SELECTED</Text>
              </View>
            )}
            {isPlaying && <WaveformIndicator status={status} barCount={3} height={14} />}
          </View>

          <Text style={styles.locationText}>
            {formatStationLocation(item)}
          </Text>

          <View style={styles.metaRow}>
            {item.frequency ? (
              <Text style={styles.freqTag}>{item.frequency}</Text>
            ) : null}
            <Text style={styles.genreText}>
              {item.genres[0] || 'GLOBAL BROADCAST'}
            </Text>
            <Text style={styles.dotSeparator}>·</Text>
            <Text style={styles.codecText}>
              {item.bitrate ? `${item.bitrate}K` : '128K'} {item.codec || 'MP3'}
            </Text>
          </View>
        </View>

        {/* Action Controls: Favorite & Play */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggleFavorite(item.id)}
            style={[styles.favBtn, isFav && styles.favBtnActive]}
            accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={[styles.favIcon, isFav && styles.favIconActive]}>
              {isFav ? '★' : '☆'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              onSelectStation(item);
              if (isPlaying) {
                pause();
              } else if (isCurrent && isPaused) {
                resume();
              } else {
                playStation(item);
              }
            }}
            style={[
              styles.playBtn,
              isSelected && !isPlaying && styles.playBtnSelected,
              isPlaying && styles.playBtnActive,
              isLoading && styles.playBtnLoading,
              isError && styles.playBtnError,
            ]}
            accessibilityLabel={isPlaying ? 'Pause station' : 'Play station'}
          >
            {isLoading ? (
              <View style={styles.tuningRow}>
                <ActivityIndicator
                  size="small"
                  color={isSelected || isPlaying ? colors.pureBlack : colors.white}
                />
                <Text
                  style={[
                    styles.playBtnText,
                    (isPlaying || isSelected) && styles.playBtnTextActive,
                    styles.tuningText,
                  ]}
                >
                  TUNING
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.playBtnText,
                  (isPlaying || isSelected) && styles.playBtnTextActive,
                  isError && styles.playBtnTextError,
                ]}
              >
                {isPlaying ? 'PAUSE' : isPaused ? 'RESUME' : isError ? 'RETRY' : 'PLAY'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          {activeFilter}
        </Text>
        <View style={styles.headerCountContainer}>
          {isLoadingDirectory && (
            <ActivityIndicator size="small" color={colors.silver} style={{ marginRight: 8 }} />
          )}
          <Text style={styles.headerCount}>
            {stations.length} {stations.length === 1 ? 'STATION' : 'STATIONS'}
          </Text>
        </View>
      </View>

      <FlatList
        data={stations}
        keyExtractor={(item) => item.id}
        renderItem={renderStationItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() =>
          isLoadingDirectory ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.white} />
              <Text style={styles.emptyTitle}>Scanning Frequencies...</Text>
              <Text style={styles.emptySubtitle}>
                Fetching live radio streams for {activeFilter} from global directory.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>No Stations in this Region</Text>
              <Text style={styles.emptySubtitle}>
                Select ALL GLOBAL or scan the global directory to discover stations.
              </Text>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.pureBlack,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surfaceDark,
  },
  headerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  headerCount: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
  listContent: {
    paddingVertical: 6,
    paddingBottom: 90,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  itemRowCurrent: {
    backgroundColor: colors.charcoal,
  },
  monogramBox: {
    width: 42,
    height: 42,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monogramBoxCurrent: {
    borderColor: colors.white,
    backgroundColor: colors.white,
  },
  monogramBoxSelected: {
    borderColor: colors.white,
    backgroundColor: '#1E1E1E',
  },
  monogramText: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '900',
    color: colors.white,
  },
  monogramTextCurrent: {
    color: colors.pureBlack,
  },
  monogramTextSelected: {
    color: colors.white,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stationTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
    lineHeight: 22,
    flexWrap: 'wrap',
    flex: 1,
  },
  locationText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.offWhite,
    lineHeight: 18,
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
    borderColor: colors.borderMedium,
    borderRadius: 2,
    letterSpacing: 0.5,
  },
  genreText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.lightSilver,
    textTransform: 'uppercase',
  },
  dotSeparator: {
    fontSize: 12,
    color: colors.midGray,
  },
  codecText: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: colors.midGray,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtnActive: {
    backgroundColor: '#261E0F',
    borderColor: '#B48A28',
  },
  favIcon: {
    fontSize: 18,
    color: colors.midGray,
  },
  favIconActive: {
    color: '#FFD700',
  },
  playBtn: {
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: 4,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    minWidth: 74,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnSelected: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  playBtnActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  playBtnLoading: {
    backgroundColor: '#26262B',
    borderColor: colors.silver,
  },
  playBtnError: {
    borderColor: '#7F1D1D',
    backgroundColor: '#261212',
  },
  playBtnText: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.8,
  },
  playBtnTextActive: {
    color: colors.pureBlack,
  },
  playBtnTextError: {
    color: '#F87171',
  },
  tuningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tuningText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  headerCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 16,
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 18,
  },
  itemRowSelected: {
    borderColor: colors.white,
    backgroundColor: '#161618',
    borderWidth: 1,
  },
  selectedPill: {
    backgroundColor: colors.white,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginLeft: 6,
  },
  selectedPillText: {
    fontFamily: 'Courier',
    fontSize: 8,
    fontWeight: '800',
    color: colors.pureBlack,
    letterSpacing: 0.5,
  },
});
