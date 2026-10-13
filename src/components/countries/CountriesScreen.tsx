import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { RadioStation } from '../../types/station';
import { stationRepository } from '../../services/radio/stationRepository';
import { formatStationLocation } from '../../utils/locationFormatter';
import { useAudioPlayer } from '../../services/audio/useAudioPlayer';
import { WaveformIndicator } from '../common/WaveformIndicator';
import { StationArtwork } from '../common/StationArtwork';

interface CountryItem {
  name: string;
  code: string;
  stationCount: number;
}

interface StateItem {
  name: string;
  country: string;
  stationCount: number;
}

interface CountriesScreenProps {
  onSelectStation: (station: RadioStation) => void;
  onToggleFavorite: (stationId: string) => void;
  favoriteIds: Set<string>;
  selectedStation?: RadioStation | null;
  contentBottomPadding?: number;
}

type BrowseLevel = 'countries' | 'states' | 'cities' | 'stations';

export const CountriesScreen: React.FC<CountriesScreenProps> = ({
  onSelectStation,
  onToggleFavorite,
  favoriteIds,
  selectedStation,
  contentBottomPadding,
}) => {
  const { currentStation, status, playStation, pause, resume } = useAudioPlayer();

  const [level, setLevel] = useState<BrowseLevel>('countries');
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<CountryItem | null>(null);

  const [states, setStates] = useState<StateItem[]>([]);
  const [selectedState, setSelectedState] = useState<StateItem | null>(null);

  const [cities, setCities] = useState<string[]>([]);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const [stations, setStations] = useState<RadioStation[]>([]);
  const [stationOffset, setStationOffset] = useState(0);
  const [hasMoreStations, setHasMoreStations] = useState(true);

  const [filterQuery, setFilterQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Load initial country list
  useEffect(() => {
    async function loadCountries() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const list = await stationRepository.getCountries(150);
        setCountries(list);
      } catch (err: any) {
        setErrorMessage('Unable to load country directory. Tap retry.');
      } finally {
        setIsLoading(false);
      }
    }
    loadCountries();
  }, []);

  // Filter countries by search query
  const displayedCountries = useMemo(() => {
    if (!filterQuery.trim()) return countries;
    const q = filterQuery.toLowerCase().trim();
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, filterQuery]);

  // Filter states by search query
  const displayedStates = useMemo(() => {
    if (!filterQuery.trim()) return states;
    const q = filterQuery.toLowerCase().trim();
    return states.filter((s) => s.name.toLowerCase().includes(q));
  }, [states, filterQuery]);

  // Drill down into country -> load states
  const handleSelectCountry = useCallback(async (country: CountryItem) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setSelectedCity(null);
    setFilterQuery('');
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const stateList = await stationRepository.getStatesByCountry(country.name, 100);
      if (stateList.length > 0) {
        setStates(stateList);
        setLevel('states');
      } else {
        // If no state subdivisions reported, jump straight to stations for this country
        await loadStationsForCountry(country.code, country.name);
      }
    } catch {
      // Fallback directly to stations
      await loadStationsForCountry(country.code, country.name);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load stations directly for a country
  const loadStationsForCountry = async (countryCode: string, countryName: string) => {
    setIsLoading(true);
    setStationOffset(0);
    setHasMoreStations(true);
    try {
      const results = await stationRepository.getStationsByCountryCode(countryCode, 40, 0);
      setStations(results);
      setLevel('stations');
    } catch (err) {
      setErrorMessage(`Failed to load stations for ${countryName}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Drill down into state -> load cities or stations
  const handleSelectState = useCallback(async (stateItem: StateItem) => {
    if (!selectedCountry) return;
    setSelectedState(stateItem);
    setSelectedCity(null);
    setFilterQuery('');
    setIsLoading(true);
    setErrorMessage(null);
    setStationOffset(0);
    setHasMoreStations(true);

    try {
      const results = await stationRepository.getStationsByCountryAndState(
        selectedCountry.code,
        stateItem.name,
        50,
        0
      );
      setStations(results);

      // Extract unique cities from returned station records
      const uniqueCities = Array.from(
        new Set(
          results
            .map((s) => s.city?.trim())
            .filter((c): c is string => Boolean(c && c.length > 1 && c.toLowerCase() !== stateItem.name.toLowerCase()))
        )
      );

      if (uniqueCities.length > 1) {
        setCities(uniqueCities);
        setLevel('cities');
      } else {
        // Show stations directly
        setLevel('stations');
      }
    } catch {
      setErrorMessage(`Failed to load stations for ${stateItem.name}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCountry]);

  // Drill down into city -> load stations
  const handleSelectCity = useCallback(async (cityName: string) => {
    if (!selectedCountry) return;
    setSelectedCity(cityName);
    setIsLoading(true);
    setErrorMessage(null);
    setStationOffset(0);
    setHasMoreStations(true);

    try {
      const results = await stationRepository.getStationsByCity(
        selectedCountry.code,
        cityName,
        50,
        0
      );
      setStations(results);
      setLevel('stations');
    } catch {
      setErrorMessage(`Failed to load stations for ${cityName}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCountry]);

  // Load more stations (pagination)
  const handleLoadMoreStations = async () => {
    if (isLoading || !hasMoreStations || !selectedCountry) return;
    const nextOffset = stationOffset + 40;
    setIsLoading(true);

    try {
      let more: RadioStation[] = [];
      if (selectedCity) {
        more = await stationRepository.getStationsByCity(
          selectedCountry.code,
          selectedCity,
          40,
          nextOffset
        );
      } else if (selectedState) {
        more = await stationRepository.getStationsByCountryAndState(
          selectedCountry.code,
          selectedState.name,
          40,
          nextOffset
        );
      } else {
        more = await stationRepository.getStationsByCountryCode(
          selectedCountry.code,
          40,
          nextOffset
        );
      }

      if (more.length === 0) {
        setHasMoreStations(false);
      } else {
        setStations((prev) => {
          const map = new Map<string, RadioStation>();
          for (const s of prev) map.set(s.id, s);
          for (const s of more) map.set(s.id, s);
          return Array.from(map.values());
        });
        setStationOffset(nextOffset);
      }
    } catch {} finally {
      setIsLoading(false);
    }
  };

  // Back Navigation
  const handleBack = () => {
    setFilterQuery('');
    setErrorMessage(null);
    if (level === 'stations') {
      if (selectedCity && cities.length > 1) {
        setSelectedCity(null);
        setLevel('cities');
      } else if (selectedState && states.length > 0) {
        setSelectedState(null);
        setLevel('states');
      } else {
        setSelectedCountry(null);
        setLevel('countries');
      }
    } else if (level === 'cities') {
      setSelectedCity(null);
      setLevel('states');
    } else if (level === 'states') {
      setSelectedState(null);
      setLevel('countries');
    }
  };

  return (
    <View style={styles.container}>
      {/* Breadcrumb Navigation Header */}
      <View style={styles.breadcrumbBar}>
        <View style={styles.breadcrumbContent}>
          {level !== 'countries' && (
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              accessibilityLabel="Navigate up a level"
            >
              <Text style={styles.backIcon}>←</Text>
              <Text style={styles.backLabel}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={styles.trailRow}>
            <TouchableOpacity onPress={() => { setLevel('countries'); setSelectedCountry(null); setSelectedState(null); setSelectedCity(null); setFilterQuery(''); }}>
              <Text style={[styles.crumbText, level === 'countries' && styles.crumbTextActive]}>
                Countries
              </Text>
            </TouchableOpacity>

            {selectedCountry && (
              <>
                <Text style={styles.crumbDivider}>›</Text>
                <TouchableOpacity onPress={() => { if (states.length > 0) { setLevel('states'); setSelectedState(null); setSelectedCity(null); setFilterQuery(''); } }}>
                  <Text style={[styles.crumbText, level === 'states' && styles.crumbTextActive]}>
                    {selectedCountry.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {selectedState && (
              <>
                <Text style={styles.crumbDivider}>›</Text>
                <TouchableOpacity onPress={() => { if (cities.length > 0) { setLevel('cities'); setSelectedCity(null); setFilterQuery(''); } }}>
                  <Text style={[styles.crumbText, level === 'cities' && styles.crumbTextActive]}>
                    {selectedState.name}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {selectedCity && (
              <>
                <Text style={styles.crumbDivider}>›</Text>
                <Text style={[styles.crumbText, styles.crumbTextActive]}>
                  {selectedCity}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Filter input for current list */}
        {level !== 'stations' && (
          <View style={styles.filterInputWrapper}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.filterInput}
              placeholder={
                level === 'countries'
                  ? 'Filter countries...'
                  : level === 'states'
                  ? 'Filter regions/states...'
                  : 'Filter cities...'
              }
              placeholderTextColor="#8E8E93"
              value={filterQuery}
              onChangeText={setFilterQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {filterQuery.length > 0 && (
              <TouchableOpacity onPress={() => setFilterQuery('')} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {isLoading && stations.length === 0 && countries.length === 0 ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading geographic directory...</Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centerState}>
          <Text style={styles.errorTitle}>Directory Notice</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => {
              if (level === 'countries') {
                stationRepository.getCountries().then(setCountries);
              } else if (selectedCountry) {
                handleSelectCountry(selectedCountry);
              }
            }}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : level === 'countries' ? (
        // --- LEVEL 1: COUNTRIES LIST ---
        <FlatList
          data={displayedCountries}
          keyExtractor={(item) => item.code || item.name}
          contentContainerStyle={[
            styles.listContainer,
            contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
          ]}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleSelectCountry(item)}
              style={styles.rowItem}
              accessibilityLabel={`Browse stations in ${item.name}`}
            >
              <View style={styles.rowLead}>
                <Text style={styles.countryCodeBadge}>{item.code || 'GL'}</Text>
                <Text style={styles.rowTitle}>{item.name}</Text>
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{item.stationCount.toLocaleString()} stations</Text>
                <Text style={styles.chevronIcon}>›</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      ) : level === 'states' ? (
        // --- LEVEL 2: STATES / REGIONS LIST ---
        <View style={styles.flex1}>
          {/* Quick Option to browse all country stations */}
          {selectedCountry && (
            <TouchableOpacity
              style={styles.browseAllBanner}
              onPress={() => loadStationsForCountry(selectedCountry.code, selectedCountry.name)}
            >
              <Text style={styles.browseAllText}>
                Browse all {selectedCountry.stationCount.toLocaleString()} stations in {selectedCountry.name} →
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={displayedStates}
            keyExtractor={(item) => item.name}
            contentContainerStyle={[
              styles.listContainer,
              contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
            ]}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelectState(item)}
                style={styles.rowItem}
              >
                <Text style={styles.rowTitle}>{item.name}</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countText}>{item.stationCount.toLocaleString()} stations</Text>
                  <Text style={styles.chevronIcon}>›</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : level === 'cities' ? (
        // --- LEVEL 3: CITIES LIST ---
        <View style={styles.flex1}>
          {/* Quick Option to browse all state stations */}
          {selectedState && (
            <TouchableOpacity
              style={styles.browseAllBanner}
              onPress={() => setLevel('stations')}
            >
              <Text style={styles.browseAllText}>
                Browse all stations in {selectedState.name} →
              </Text>
            </TouchableOpacity>
          )}

          <FlatList
            data={cities}
            keyExtractor={(item) => item}
            contentContainerStyle={[
              styles.listContainer,
              contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
            ]}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => handleSelectCity(item)}
                style={styles.rowItem}
              >
                <Text style={styles.rowTitle}>{item}</Text>
                <Text style={styles.chevronIcon}>›</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      ) : (
        // --- LEVEL 4: STATIONS LIST ---
        <FlatList
          data={stations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            contentBottomPadding != null ? { paddingBottom: contentBottomPadding } : null,
          ]}
          onEndReachedThreshold={0.4}
          onEndReached={handleLoadMoreStations}
          ListFooterComponent={() =>
            isLoading ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.footerLoaderText}>Loading more stations...</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isSelected = selectedStation?.id === item.id;
            const isCurrent = currentStation?.id === item.id;
            const isPlaying = isCurrent && status === 'playing';
            const isLoadingStation = isCurrent && status === 'loading';
            const isError = isCurrent && status === 'error';
            const isFav = favoriteIds.has(item.id);

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
                {/* Station Artwork Cover */}
                <StationArtwork station={item} size={44} style={{ marginRight: 12 }} />

                {/* Station Info Col */}
                <View style={styles.stationInfoCol}>
                  <View style={styles.stationTitleRow}>
                    <Text style={styles.stationName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    {isPlaying && <WaveformIndicator status={status} barCount={3} height={12} />}
                  </View>

                  <Text style={styles.locationText} numberOfLines={2}>
                    {formatStationLocation(item)}
                  </Text>

                  <View style={styles.metaBadgeRow}>
                    {item.frequency && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>{item.frequency}</Text>
                      </View>
                    )}
                    {item.languages?.[0] && (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgePillText}>{item.languages[0]}</Text>
                      </View>
                    )}
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>{item.genres[0] || 'Radio'}</Text>
                    </View>
                    <Text style={styles.codecText}>
                      {item.bitrate ? `${item.bitrate}k` : '128k'} {item.codec || 'MP3'}
                    </Text>
                  </View>
                </View>

                {/* Controls */}
                <View style={styles.stationActions}>
                  <TouchableOpacity
                    onPress={() => onToggleFavorite(item.id)}
                    style={styles.favBtn}
                    accessibilityLabel={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Text style={[styles.favIcon, isFav && styles.favIconActive]}>
                      {isFav ? '★' : '☆'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      onSelectStation(item);
                      if (isPlaying) {
                        pause();
                      } else if (isCurrent && status === 'paused') {
                        resume();
                      } else {
                        playStation(item);
                      }
                    }}
                    style={[
                      styles.playBtn,
                      isSelected && !isPlaying && styles.playBtnSelected,
                      isPlaying && styles.playBtnActive,
                      isLoadingStation && styles.playBtnLoading,
                    ]}
                  >
                    {isLoadingStation ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                        <Text style={[styles.playBtnText, { color: '#FFFFFF', fontSize: 11 }]}>TUNING</Text>
                      </View>
                    ) : (
                      <Text style={[styles.playBtnText, isPlaying && styles.playBtnTextActive]}>
                        {isPlaying ? 'PAUSE' : isError ? 'RETRY' : 'PLAY'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex1: {
    flex: 1,
  },
  breadcrumbBar: {
    backgroundColor: '#0F0F0F',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  breadcrumbContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    minHeight: 36,
    gap: 4,
  },
  backIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  crumbText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
  crumbTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  crumbDivider: {
    color: '#555555',
    fontSize: 16,
  },
  filterInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchIcon: {
    color: '#8E8E93',
    fontSize: 16,
  },
  filterInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    padding: 4,
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 14,
  },
  listContainer: {
    padding: 12,
    gap: 8,
    paddingBottom: 90,
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  countryCodeBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countText: {
    fontSize: 13,
    color: '#8E8E93',
  },
  chevronIcon: {
    color: '#8E8E93',
    fontSize: 18,
    fontWeight: 'bold',
  },
  browseAllBanner: {
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2C',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  browseAllText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: '#8E8E93',
    fontSize: 15,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryBtnText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 8,
    padding: 14,
    gap: 12,
  },
  stationCardSelected: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1C1C1C',
  },
  stationCardCurrent: {
    borderColor: '#8E8E93',
  },
  stationInfoCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  stationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    minWidth: 0,
    lineHeight: 22,
  },
  locationText: {
    fontSize: 14,
    color: '#A3A3A3',
    lineHeight: 18,
  },
  metaBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  badgePill: {
    backgroundColor: '#202020',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D4D4D4',
  },
  codecText: {
    fontSize: 11,
    color: '#737373',
    marginLeft: 2,
  },
  stationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262626',
  },
  favIcon: {
    fontSize: 20,
    color: '#737373',
  },
  favIconActive: {
    color: '#FFFFFF',
  },
  playBtn: {
    minWidth: 64,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  playBtnSelected: {
    backgroundColor: '#FFFFFF',
  },
  playBtnActive: {
    backgroundColor: '#333333',
  },
  playBtnLoading: {
    backgroundColor: '#404040',
  },
  playBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  playBtnTextActive: {
    color: '#FFFFFF',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  footerLoaderText: {
    color: '#8E8E93',
    fontSize: 13,
  },
});
