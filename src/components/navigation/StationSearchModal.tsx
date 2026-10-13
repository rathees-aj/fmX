import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { RadioStation } from '../../types/station';
import { colors } from '../../theme/colors';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { calculateStationRelevance } from '../../services/radio/stationRepository';
import { formatStationLocation } from '../../utils/locationFormatter';

interface StationSearchModalProps {
  visible: boolean;
  onClose: () => void;
  stations: RadioStation[];
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
}

export const StationSearchModal: React.FC<StationSearchModalProps> = ({
  visible,
  onClose,
  stations,
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
}) => {
  const [query, setQuery] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [remoteResults, setRemoteResults] = useState<RadioStation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const activeSearchIdRef = React.useRef(0);
  const { currentStation, status } = useAudioPlayer();

  // Reset pagination when query changes
  React.useEffect(() => {
    setOffset(0);
    setHasMore(true);
  }, [query]);

  // Live remote directory search with 300ms debounce and race condition prevention
  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setRemoteResults([]);
      setIsSearching(false);
      setSearchError(null);
      setOffset(0);
      return;
    }

    const currentSearchId = ++activeSearchIdRef.current;
    setIsSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const { stationRepository } = await import('../../services/radio/stationRepository');
        const results = await stationRepository.search({ query: trimmed, limit: 30, offset: 0 });
        if (activeSearchIdRef.current === currentSearchId) {
          setRemoteResults(results);
          setIsSearching(false);
          setHasMore(results.length >= 20);
        }
      } catch (err: any) {
        if (activeSearchIdRef.current === currentSearchId) {
          console.warn('[fmX Search Modal] Error searching directory:', err);
          setSearchError(err?.message || 'Directory communication failure');
          setIsSearching(false);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleRetry = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const currentSearchId = ++activeSearchIdRef.current;
    setIsSearching(true);
    setSearchError(null);
    setOffset(0);
    import('../../services/radio/stationRepository').then(({ stationRepository }) => {
      stationRepository
        .search({ query: trimmed, limit: 30, offset: 0 })
        .then((results) => {
          if (activeSearchIdRef.current === currentSearchId) {
            setRemoteResults(results);
            setIsSearching(false);
            setHasMore(results.length >= 20);
          }
        })
        .catch((err) => {
          if (activeSearchIdRef.current === currentSearchId) {
            setSearchError(err?.message || 'Directory communication failure');
            setIsSearching(false);
          }
        });
    });
  };

  const handleLoadMore = async () => {
    const trimmed = query.trim();
    if (isLoadingMore || !hasMore || !trimmed) return;
    setIsLoadingMore(true);
    const nextOffset = offset + 30;

    try {
      const { stationRepository } = await import('../../services/radio/stationRepository');
      const more = await stationRepository.search({ query: trimmed, limit: 30, offset: nextOffset });
      if (more.length === 0) {
        setHasMore(false);
      } else {
        setRemoteResults((prev) => [...prev, ...more]);
        setOffset(nextOffset);
        setHasMore(more.length >= 20);
      }
    } catch {
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Combine and rank stations by relevance across name, city, state, country, and tags
  const searchResults = React.useMemo(() => {
    if (!query.trim()) {
      return stations;
    }
    const localMatches = stations.filter((s) => calculateStationRelevance(s, query) > 0);
    const combined = [...remoteResults, ...localMatches];

    const seenUuids = new Set<string>();
    const seenUrls = new Set<string>();
    const unique: RadioStation[] = [];

    for (const s of combined) {
      if (s.id && seenUuids.has(s.id)) continue;
      const normUrl = s.streamUrl
        ? s.streamUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
        : '';
      if (normUrl && seenUrls.has(normUrl)) continue;

      if (s.id) seenUuids.add(s.id);
      if (normUrl) seenUrls.add(normUrl);
      unique.push(s);
    }

    return unique.sort((a, b) => calculateStationRelevance(b, query) - calculateStationRelevance(a, query));
  }, [stations, remoteResults, query]);

  const filteredStations = React.useMemo(() => {
    if (showFavoritesOnly) {
      return searchResults.filter((s) => favoriteIds.has(s.id));
    }
    return searchResults;
  }, [searchResults, showFavoritesOnly, favoriteIds]);

  const renderStationItem = ({ item }: { item: RadioStation }) => {
    const isPlaying = currentStation?.id === item.id && status === 'playing';
    const isFav = favoriteIds.has(item.id);
    const hasGeo =
      item.hasCoordinates !== false &&
      typeof item.latitude === 'number' &&
      typeof item.longitude === 'number' &&
      (Math.abs(item.latitude) > 0.001 || Math.abs(item.longitude) > 0.001);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => {
          onSelectStation(item);
          onClose();
        }}
        style={[styles.itemRow, isPlaying && styles.itemRowActive]}
      >
        <View style={styles.itemMain}>
          <View style={styles.titleRow}>
            <Text style={styles.stationName}>
              {item.name}
            </Text>
            {isPlaying && <WaveformIndicator status={status} barCount={3} height={14} />}
          </View>
          <Text style={styles.metaRow}>
            {formatStationLocation(item)} • {item.frequency || 'DIGITAL'} • {hasGeo ? 'GEO-PINNED' : 'DIGITAL'} • {item.genres[0] || 'Radio'}
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => onToggleFavorite(item.id)}
          style={styles.favButton}
        >
          <Text style={[styles.favText, isFav && styles.favTextActive]}>
            {isFav ? '★' : '☆'}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>TERRESTRIAL DIRECTORY</Text>
            <Text style={styles.headerSubtitle}>
              {isSearching
                ? 'SCANNING SPECTRUM...'
                : `${filteredStations.length} ${filteredStations.length === 1 ? 'STATION' : 'STATIONS'} AVAILABLE`}
            </Text>
          </View>

          <TouchableOpacity activeOpacity={0.7} onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>CLOSE [✕]</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar & Filter Toggle */}
        <View style={styles.filterSection}>
          <View style={styles.inputWrapper}>
            <Text style={styles.inputPrefix}>SCAN &gt;</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="SEARCH BY NAME, CITY, GENRE..."
              placeholderTextColor={colors.graphite}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Text style={styles.clearText}>CLR</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={[styles.favFilterBtn, showFavoritesOnly && styles.favFilterBtnActive]}
          >
            <Text
              style={[
                styles.favFilterText,
                showFavoritesOnly && styles.favFilterTextActive,
              ]}
            >
              {showFavoritesOnly ? '★ SAVED ONLY' : '☆ ALL STATIONS'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Station List */}
        <FlatList
          data={filteredStations}
          keyExtractor={(item) => item.id}
          renderItem={renderStationItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              {searchError ? (
                <>
                  <Text style={styles.emptyTitle}>SIGNAL INTERRUPTION</Text>
                  <Text style={styles.emptySubtitle}>
                    {searchError}. Live directory mirrors could not be reached.
                  </Text>
                  <TouchableOpacity activeOpacity={0.7} onPress={handleRetry} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>RETRY SCAN [↺]</Text>
                  </TouchableOpacity>
                </>
              ) : isSearching ? (
                <>
                  <Text style={styles.emptyTitle}>SCANNING SPECTRUM...</Text>
                  <Text style={styles.emptySubtitle}>
                    Querying directory across name, city, state and tags.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.emptyTitle}>NO FREQUENCIES DETECTED</Text>
                  <Text style={styles.emptySubtitle}>
                    {query.trim()
                      ? `No broadcasts matched "${query}" across station name, city, state, or tags.`
                      : 'No broadcast matched the search parameters.'}
                  </Text>
                </>
              )}
            </View>
          )}
          ListFooterComponent={() =>
            query.trim() && filteredStations.length > 0 && hasMore ? (
              <View style={styles.loadMoreWrapper}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleLoadMore}
                  disabled={isLoadingMore}
                  style={styles.loadMoreBtn}
                >
                  <Text style={styles.loadMoreText}>
                    {isLoadingMore ? 'LOADING BROADCASTS...' : 'LOAD MORE BROADCASTS [↓]'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.void,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  headerTitle: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: '800',
    color: colors.pureWhite,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: colors.silverMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
  },
  closeBtnText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.pureWhite,
    letterSpacing: 1,
  },
  filterSection: {
    padding: 16,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.deepCharcoal,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: 12,
    borderRadius: 2,
    gap: 8,
  },
  inputPrefix: {
    fontFamily: 'Courier',
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontFamily: 'Courier',
    fontSize: 12,
    color: colors.pureWhite,
    letterSpacing: 0.5,
  },
  clearText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silverMuted,
  },
  favFilterBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 2,
    backgroundColor: colors.surfaceDark,
  },
  favFilterBtnActive: {
    borderColor: colors.pureWhite,
    backgroundColor: colors.pureWhite,
  },
  favFilterText: {
    fontFamily: 'Courier',
    fontSize: 9,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
  },
  favFilterTextActive: {
    color: colors.void,
  },
  listContent: {
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  itemRowActive: {
    backgroundColor: colors.surfaceElevated,
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationName: {
    fontFamily: 'Courier',
    fontSize: 14,
    fontWeight: '700',
    color: colors.pureWhite,
    letterSpacing: 0.5,
  },
  metaRow: {
    fontFamily: 'Courier',
    fontSize: 10,
    color: colors.silver,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  favButton: {
    padding: 8,
  },
  favText: {
    fontSize: 16,
    color: colors.silverMuted,
  },
  favTextActive: {
    color: colors.pureWhite,
  },
  separator: {
    height: 1,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '700',
    color: colors.silverBright,
    letterSpacing: 1,
  },
  emptySubtitle: {
    fontFamily: 'Courier',
    fontSize: 11,
    color: colors.silverMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.pureWhite,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 2,
  },
  retryBtnText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '800',
    color: colors.pureWhite,
    letterSpacing: 1,
  },
  loadMoreWrapper: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadMoreBtn: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 2,
  },
  loadMoreText: {
    fontFamily: 'Courier',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.8,
  },
});
