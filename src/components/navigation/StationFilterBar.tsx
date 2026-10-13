import React from 'react';
import { ScrollView, Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';

export interface FilterOption {
  id: string;
  label: string;
  category: 'region' | 'genre';
}

export const DISCOVERY_FILTERS: FilterOption[] = [
  // Geographic Regions
  { id: 'ALL', label: 'ALL GLOBAL', category: 'region' },
  { id: 'INDIA', label: 'INDIA', category: 'region' },
  { id: 'ASIA', label: 'ASIA', category: 'region' },
  { id: 'EUROPE', label: 'EUROPE', category: 'region' },
  { id: 'NORTH_AMERICA', label: 'NORTH AMERICA', category: 'region' },
  { id: 'SOUTH_AMERICA', label: 'SOUTH AMERICA', category: 'region' },
  { id: 'OCEANIA', label: 'OCEANIA', category: 'region' },
  // Curated Languages & Musical Genres
  { id: 'TAMIL', label: 'TAMIL', category: 'genre' },
  { id: 'ELECTRONIC', label: 'ELECTRONIC', category: 'genre' },
  { id: 'JAZZ', label: 'JAZZ / SOUL', category: 'genre' },
  { id: 'INDIE', label: 'INDIE / ROCK', category: 'genre' },
  { id: 'AMBIENT', label: 'AMBIENT', category: 'genre' },
  { id: 'CLASSICAL', label: 'CLASSICAL', category: 'genre' },
  { id: 'NEWS', label: 'NEWS / TALK', category: 'genre' },
];

interface StationFilterBarProps {
  activeFilter: string;
  onSelectFilter: (filterId: string) => void;
}

export const StationFilterBar: React.FC<StationFilterBarProps> = ({
  activeFilter,
  onSelectFilter,
}) => {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
        contentContainerStyle={styles.container}
      >
        {DISCOVERY_FILTERS.map((f, idx) => {
          const isActive = activeFilter === f.id;
          const isFirstGenre = f.category === 'genre' && DISCOVERY_FILTERS[idx - 1]?.category === 'region';

          return (
            <React.Fragment key={f.id}>
              {isFirstGenre && <View style={styles.divider} />}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onSelectFilter(f.id)}
                style={[
                  styles.chip,
                  f.category === 'genre' && styles.genreChip,
                  isActive && styles.chipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.chipText,
                    f.category === 'genre' && styles.genreText,
                    isActive && styles.chipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.pureBlack,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  scrollView: {
    width: '100%',
    maxWidth: '100%',
  },
  container: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: '#333333',
    marginHorizontal: 4,
    flexShrink: 0,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 38,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#262626',
    backgroundColor: '#141414',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  genreChip: {
    borderColor: '#2F2F2F',
  },
  chipActive: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D4D4D4',
    letterSpacing: 0.3,
  },
  genreText: {
    color: '#E5E5E5',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
});
