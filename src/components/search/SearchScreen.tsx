import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
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

interface SearchScreenProps {
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
  selectedStation?: RadioStation | null;
  contentBottomPadding?: number;
}

const QUICK_FILTERS = [
  'ALL',
  'JAZZ',
  'NEWS',
  'CLASSICAL',
  'ELECTRONIC',
  'ROCK',
  'AMBIENT',
  'TAMIL',
  'HINDI',
  'TALK',
];

export const SearchScreen: React.FC<SearchScreenProps> = ({
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
  selectedStation,
  contentBottomPadding,
}) => {
  const { currentStation, status, playStation, pause, resume } = useAudioPlayer();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilterTag, setActiveFilterTag] = useState('ALL');
  const [results, setResults] = useState<RadioStation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const activeSearchIdRef = useRef(0);

  const executeSearch = useCallback(
    async (queryText: string, tag: string, nextOffset = 0, isPaging = false) => {
      const searchId = ++activeSearchIdRef.current;
      const cleanQuery = queryText.trim();
      const hasQuery = cleanQuery.length >= 1;
      const hasTag = tag !== 'ALL';

      if (isPaging) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setErrorMessage(null);
      }

      try {
        let fetched: RadioStation[] = [];
        if (!hasQuery && !hasTag) {
          // Empty initial search state: display popular/featured global broadcasters
          fetched = await stationRepository.getCuratedStations(30);
        } else if (hasTag && !hasQuery) {
          fetched = await stationRepository.search({
            tag: tag.toLowerCase(),
            limit: 30,
            offset: nextOffset,
          });
        } else if (hasTag && hasQuery) {
          fetched = await stationRepository.search({
            query: cleanQuery,
            tag: tag.toLowerCase(),
            limit: 30,
            offset: nextOffset,
          });
        } else {
          fetched = await stationRepository.search({
            query: cleanQuery,
            limit: 30,
            offset: nextOffset,
          });
        }

        if (activeSearchIdRef.current === searchId) {
          if (isPaging) {
            setResults((prev) => {
              const map = new Map<string, RadioStation>();
              prev.forEach((s) => map.set(s.id, s));
              fetched.forEach((s) => map.set(s.id, s));
              return Array.from(map.values());
            });
          } else {
            setResults(fetched);
          }
          setOffset(nextOffset);
          setHasMore(fetched.length >= 25);
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      } catch (err: any) {
        if (activeSearchIdRef.current === searchId) {
          console.warn('[fmX SearchScreen] Search error:', err);
          setErrorMessage(err?.message || 'Directory search temporary failure. Please retry.');
          setIsLoading(false);
          setIsLoadingMore(false);
        }
      }
    },
    []
  );

  // Debounced search on query or tag change (approx 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      executeSearch(searchQuery, activeFilterTag, 0, false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeFilterTag, executeSearch]);

  const handleClear = () => {
    setSearchQuery('');
    setOffset(0);
    executeSearch('', activeFilterTag, 0, false);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      executeSearch(searchQuery, activeFilterTag, offset + 30, true);
    }
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
      {/* Search Header */}
      <View style={styles.headerArea}>
        <Text style={styles.screenHeading}>GLOBAL SEARCH</Text>
        <Text style={styles.screenSubheading}>
          Search across station names, cities, regions, countries, languages, and genres.
        </Text>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.input}
            placeholder="Search by station, city, country, or genre..."
            placeholderTextColor={colors.midGray}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Global radio search field"
          />
          {(searchQuery.length > 0 || activeFilterTag !== 'ALL') && (
            <TouchableOpacity
              onPress={handleClear}
              style={styles.clearBtn}
              accessibilityLabel="Clear search input"
            >
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Filter Tag Carousel */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={QUICK_FILTERS}
          keyExtractor={(item) => item}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = activeFilterTag === item;
            return (
              <TouchableOpacity
                onPress={() => setActiveFilterTag(item)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Results Header / Summary */}
      <View style={styles.resultsBar}>
        {isLoading ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.white} />
            <Text style={styles.statusText}>Searching directory across all fields...</Text>
          </View>
        ) : (
          <Text style={styles.resultsCount}>
            {results.length > 0
              ? searchQuery.length >= 1 || activeFilterTag !== 'ALL'
                ? `${results.length} STATIONS FOUND`
                : `${results.length} FEATURED GLOBAL BROADCASTERS`
              : searchQuery.length >= 1 || activeFilterTag !== 'ALL'
              ? 'NO DIRECTORY MATCHES'
              : 'POPULAR BROADCASTERS'}
          </Text>
        )}
      </View>

      {/* Error state */}
      {errorMessage && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => executeSearch(searchQuery, activeFilterTag, 0, false)}
          >
            <Text style={styles.retryBtnText}>RETRY SEARCH</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderStationItem}
        contentContainerStyle={[
          styles.listContent,
          contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
        ]}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📻</Text>
              <Text style={styles.emptyTitle}>
                {searchQuery.length >= 2 || activeFilterTag !== 'ALL'
                  ? 'No stations matched your search criteria'
                  : 'Discover 60,000+ Worldwide Broadcasters'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery.length >= 2
                  ? 'Try searching by country (e.g. "India", "Germany"), city (e.g. "Paris", "Chennai"), or genre (e.g. "Jazz", "News").'
                  : 'Type a station name or city above, or tap one of the quick tags to explore.'}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={handleLoadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.loadMoreText}>LOAD MORE BROADCASTS</Text>
              )}
            </TouchableOpacity>
          ) : null
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
  headerArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
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
    marginBottom: 12,
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.charcoal,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    borderRadius: 6,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    fontSize: 18,
    color: colors.silver,
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: colors.white,
    fontSize: 15,
  },
  clearBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearIcon: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '700',
  },
  filterList: {
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.offWhite,
    letterSpacing: 0.8,
  },
  filterChipTextActive: {
    color: colors.pureBlack,
  },
  resultsBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surfaceDark,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 12,
    color: colors.silver,
    fontFamily: 'Courier',
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 0.8,
    fontFamily: 'Courier',
  },
  errorBanner: {
    margin: 16,
    padding: 14,
    backgroundColor: '#1E1212',
    borderWidth: 1,
    borderColor: '#4A2020',
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#E06C75',
    fontSize: 13,
    flex: 1,
  },
  retryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E06C75',
    borderRadius: 4,
    marginLeft: 12,
  },
  retryBtnText: {
    color: '#E06C75',
    fontSize: 11,
    fontWeight: '700',
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
  loadMoreBtn: {
    minHeight: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderMedium,
    backgroundColor: colors.surfaceDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  loadMoreText: {
    fontFamily: 'Courier',
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 1,
  },
});
