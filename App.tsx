import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
  Platform,
  useWindowDimensions,
  Text,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayerProvider, useAudioPlayer } from './src/services/audio/useAudioPlayer';
import { stationRepository } from './src/services/radio/stationRepository';
import { RadioStation } from './src/types/station';
import { colors } from './src/theme/colors';
import { Header } from './src/components/navigation/Header';
import { StationFilterBar } from './src/components/navigation/StationFilterBar';
import { StationCard } from './src/components/player/StationCard';
import { MiniPlayer } from './src/components/player/MiniPlayer';
import { BottomNav, NavTab } from './src/components/navigation/BottomNav';
import { StationListView } from './src/components/navigation/StationListView';
import { CountriesScreen } from './src/components/countries/CountriesScreen';
import { SearchScreen } from './src/components/search/SearchScreen';
import { MyStationsScreen } from './src/components/mystations/MyStationsScreen';
import { SavedScreen } from './src/components/saved/SavedScreen';
import { LoadingScreen } from './src/components/common/LoadingScreen';
import { isStationInRegion, isTamilLanguageStation, isStationInIndia } from './src/utils/regionMapping';

function MainScreen() {
  const { width } = useWindowDimensions();
  const isWideScreen = width >= 768;
  const insets = useSafeAreaInsets();

  const { currentStation, status, playStation } = useAudioPlayer();

  const isMiniPlayerActive = Boolean(currentStation && status !== 'idle');
  const listBottomPadding = 56 + insets.bottom + (isMiniPlayerActive ? 58 : 0) + 24;

  const [allStations, setAllStations] = useState<RadioStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<RadioStation | null>(null);
  const [cardVisible, setCardVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<NavTab>('explore');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // Load curated stations and favorites from local persistence
  useEffect(() => {
    async function initCatalogue() {
      try {
        const [stations, saved] = await Promise.all([
          stationRepository.getCuratedStations(),
          stationRepository.getSavedStations(),
        ]);
        setAllStations(stations);

        const favs = new Set<string>(saved.map((s: RadioStation) => s.id));
        setFavoriteIds(favs);

        if (stations.length > 0 && !selectedStation) {
          setSelectedStation(stations[0]);
        }
      } catch (err) {
        console.warn('[fmX Main] Failed initializing station catalogue:', err);
      } finally {
        setTimeout(() => setIsBootstrapping(false), 1200);
      }
    }
    initCatalogue();
  }, []);

  // Record playback in local history whenever a station is actively playing
  useEffect(() => {
    if (currentStation && status === 'playing') {
      stationRepository.recordStationPlayed(currentStation);
    }
  }, [currentStation?.id, status]);

  // Handle native Android system back button navigation
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const onBackPress = () => {
      // 1. Close full station card modal if open
      if (cardVisible) {
        setCardVisible(false);
        return true;
      }
      // 2. Return to Explore tab if on secondary tab
      if (activeTab !== 'explore') {
        setActiveTab('explore');
        return true;
      }
      // 3. Fallback to default Android behavior (exit app)
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress
    );
    return () => subscription.remove();
  }, [cardVisible, activeTab]);

  // Regional and genre filtering for the Explore tab
  const displayedStations = useMemo(() => {
    if (activeFilter === 'ALL') return allStations;

    return allStations.filter((s) => {
      switch (activeFilter) {
        case 'INDIA':
          return isStationInIndia(s);
        case 'TAMIL':
          return isTamilLanguageStation(s);
        case 'AFRICA':
          return isStationInRegion(s, 'AFRICA');
        case 'ASIA':
          return isStationInRegion(s, 'ASIA');
        case 'EUROPE':
          return isStationInRegion(s, 'EUROPE');
        case 'NORTH_AMERICA':
          return isStationInRegion(s, 'NORTH_AMERICA');
        case 'SOUTH_AMERICA':
          return isStationInRegion(s, 'SOUTH_AMERICA');
        case 'OCEANIA':
          return isStationInRegion(s, 'OCEANIA');
        case 'ELECTRONIC':
          return s.genres.some((g) => /electronic|house|techno|ambient|chillout|dance|edm|synth/i.test(g));
        case 'JAZZ':
          return s.genres.some((g) => /jazz|funk|soul|blues|bossa/i.test(g));
        case 'INDIE':
          return s.genres.some((g) => /indie|alternative|rock|post-punk/i.test(g));
        case 'AMBIENT':
          return s.genres.some((g) => /ambient|downtempo|chillout|drone|meditation/i.test(g));
        case 'CLASSICAL':
          return s.genres.some((g) => /classical|orchestra|opera|baroque/i.test(g));
        case 'NEWS':
          return s.genres.some((g) => /news|talk|journalism|public|information/i.test(g));
        default:
          return true;
      }
    });
  }, [allStations, activeFilter]);

  const [isFilterLoading, setIsFilterLoading] = useState(false);

  // Progressive regional exploration: fetch additional directory stations when switching filters
  useEffect(() => {
    if (activeFilter === 'ALL') return;
    let isMounted = true;
    async function loadMoreForFilter() {
      setIsFilterLoading(true);
      try {
        const more = await stationRepository.fetchRegionBatch(activeFilter);
        if (isMounted && more.length > 0) {
          setAllStations((prev) => {
            const map = new Map<string, RadioStation>();
            for (const s of prev) map.set(s.id, s);
            for (const s of more) map.set(s.id, s);
            return Array.from(map.values());
          });
        }
      } catch (err) {
        console.warn('[fmX Main] Error fetching region batch:', err);
      } finally {
        if (isMounted) {
          setIsFilterLoading(false);
        }
      }
    }
    loadMoreForFilter();
    return () => {
      isMounted = false;
    };
  }, [activeFilter]);

  const handleSelectStation = useCallback((station: RadioStation) => {
    setSelectedStation(station);
    setCardVisible(true);
    stationRepository.recordStationPlayed(station);
  }, []);

  const handleToggleFavorite = useCallback(async (stationId: string) => {
    const isFav = await stationRepository.toggleFavorite(stationId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.add(stationId);
      else next.delete(stationId);
      return next;
    });

    setAllStations((prev) =>
      prev.map((s) => (s.id === stationId ? { ...s, isFavorite: isFav } : s))
    );

    if (selectedStation?.id === stationId) {
      setSelectedStation((prev) => (prev ? { ...prev, isFavorite: isFav } : null));
    }
  }, [selectedStation]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'countries':
        return (
          <CountriesScreen
            onSelectStation={handleSelectStation}
            onToggleFavorite={handleToggleFavorite}
            favoriteIds={favoriteIds}
            selectedStation={selectedStation}
            contentBottomPadding={listBottomPadding}
          />
        );

      case 'search':
        return (
          <SearchScreen
            onSelectStation={handleSelectStation}
            onToggleFavorite={handleToggleFavorite}
            favoriteIds={favoriteIds}
            selectedStation={selectedStation}
            contentBottomPadding={listBottomPadding}
          />
        );

      case 'mystations':
        return (
          <MyStationsScreen
            onSelectStation={handleSelectStation}
            onToggleFavorite={handleToggleFavorite}
            favoriteIds={favoriteIds}
            selectedStation={selectedStation}
            contentBottomPadding={listBottomPadding}
          />
        );

      case 'saved':
        return (
          <SavedScreen
            onSelectStation={handleSelectStation}
            onToggleFavorite={handleToggleFavorite}
            favoriteIds={favoriteIds}
            selectedStation={selectedStation}
            contentBottomPadding={listBottomPadding}
          />
        );

      case 'explore':
      default:
        if (isWideScreen) {
          // Desktop 2-column layout: Left column = Station list, Right column = Full player view
          return (
            <View style={styles.twoColumnContainer}>
              <View style={styles.leftColumn}>
                <StationFilterBar
                  activeFilter={activeFilter}
                  onSelectFilter={setActiveFilter}
                />
                <StationListView
                  stations={displayedStations}
                  selectedStation={selectedStation}
                  onSelectStation={handleSelectStation}
                  onToggleFavorite={handleToggleFavorite}
                  favoriteIds={favoriteIds}
                  activeFilter={activeFilter}
                  isLoadingDirectory={isFilterLoading}
                  contentBottomPadding={listBottomPadding}
                />
              </View>

              <View style={styles.rightColumn}>
                <View style={styles.playerHeaderBar}>
                  <Text style={styles.playerHeaderTitle}>NOW TUNED / FREQUENCY DETAILS</Text>
                </View>
                {selectedStation ? (
                  <View style={styles.desktopCardWrapper}>
                    <StationCard
                      station={selectedStation}
                      onClose={() => setCardVisible(false)}
                      onToggleFavorite={handleToggleFavorite}
                      isFavorite={favoriteIds.has(selectedStation.id)}
                      onFindSimilar={() => setActiveTab('search')}
                    />
                  </View>
                ) : (
                  <View style={styles.desktopEmptyPlayer}>
                    <Text style={styles.desktopEmptyIcon}>📻</Text>
                    <Text style={styles.desktopEmptyTitle}>Select a station to tune in</Text>
                    <Text style={styles.desktopEmptySubtitle}>
                      Click any broadcaster on the left to inspect high-fidelity audio streams, verified coordinates, and broadcast metadata.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          );
        }

        // Mobile layout: Filter strip + Station list + floating card sheet
        return (
          <View style={styles.mobileExploreContainer}>
            <StationFilterBar
              activeFilter={activeFilter}
              onSelectFilter={setActiveFilter}
            />
            <StationListView
              stations={displayedStations}
              selectedStation={selectedStation}
              onSelectStation={handleSelectStation}
              onToggleFavorite={handleToggleFavorite}
              favoriteIds={favoriteIds}
              activeFilter={activeFilter}
              isLoadingDirectory={isFilterLoading}
              contentBottomPadding={listBottomPadding}
            />

            {/* Mobile Selected Station Floating Sheet */}
            {cardVisible && selectedStation && (
              <View style={styles.floatingCardWrapper}>
                <StationCard
                  station={selectedStation}
                  onClose={() => setCardVisible(false)}
                  onToggleFavorite={handleToggleFavorite}
                  isFavorite={favoriteIds.has(selectedStation.id)}
                  onFindSimilar={() => {
                    setCardVisible(false);
                    setActiveTab('search');
                  }}
                />
              </View>
            )}
          </View>
        );
    }
  };

  if (isBootstrapping) {
    return (
      <View
        style={[
          styles.rootContainer,
          { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0) : insets.top },
        ]}
      >
        <StatusBar barStyle="light-content" backgroundColor={colors.pureBlack} />
        <LoadingScreen />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.rootContainer,
        { paddingTop: Platform.OS === 'android' ? Math.max(insets.top, StatusBar.currentHeight || 0) : insets.top },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={colors.pureBlack} />

      {/* fmX Brand Header */}
      <Header
        stationCount={allStations.length}
        onOpenSearch={() => setActiveTab('search')}
        showSearchBar={activeTab !== 'search'}
      />

      {/* Tab Screen Content */}
      <View style={styles.mainContentArea}>
        {renderTabContent()}
      </View>

      {/* Persistent Mini Player (available across all screens) */}
      <MiniPlayer
        onExpandStation={(station) => {
          setSelectedStation(station);
          setCardVisible(true);
        }}
      />

      {/* Primary 5-Tab Navigation */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        savedCount={favoriteIds.size}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.pureBlack }}>
      <AudioPlayerProvider>
        <MainScreen />
      </AudioPlayerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.pureBlack,
  },
  mainContentArea: {
    flex: 1,
    backgroundColor: colors.pureBlack,
    minWidth: 0,
  },
  twoColumnContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.pureBlack,
  },
  leftColumn: {
    flex: 1.1,
    borderRightWidth: 1,
    borderRightColor: colors.borderSubtle,
    backgroundColor: colors.pureBlack,
  },
  rightColumn: {
    flex: 0.9,
    backgroundColor: colors.nearBlack,
    padding: 20,
  },
  playerHeaderBar: {
    paddingBottom: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  playerHeaderTitle: {
    fontFamily: 'Courier',
    fontSize: 12,
    fontWeight: '800',
    color: colors.silver,
    letterSpacing: 1.2,
  },
  desktopCardWrapper: {
    maxWidth: 540,
  },
  desktopEmptyPlayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  desktopEmptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    color: colors.midGray,
  },
  desktopEmptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
    marginBottom: 8,
    textAlign: 'center',
  },
  desktopEmptySubtitle: {
    fontSize: 14,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  mobileExploreContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: colors.pureBlack,
  },
  floatingCardWrapper: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    zIndex: 40,
    maxWidth: 500,
    marginHorizontal: 'auto',
  },
});
