import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { colors } from '../../theme/colors';
import { FmXLogo } from '../common/FmXLogo';

interface HeaderProps {
  onOpenSearch: () => void;
  stationCount: number;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  showInlineSearch?: boolean;
  showSearchBar?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  stationCount,
  searchQuery = '',
  onSearchChange,
  showInlineSearch = false,
  showSearchBar = true,
}) => {
  const [utcTime, setUtcTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, '0');
      const mins = String(now.getUTCMinutes()).padStart(2, '0');
      setUtcTime(`${hours}:${mins} UTC`);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.header}>
      {/* Brand Identity */}
      <View style={styles.brandRow}>
        <FmXLogo size={40} showWordmark={true} />

        <View style={styles.metaGroup}>
          <View style={styles.stationBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeText}>
              {stationCount > 0 ? `${stationCount} ON AIR` : 'GLOBAL RADIO'}
            </Text>
          </View>
          <Text style={styles.utcText}>{utcTime}</Text>
        </View>
      </View>

      {/* Quick Search Action Bar */}
      {showSearchBar && (
        showInlineSearch && onSearchChange ? (
          <View style={styles.inlineSearchContainer}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.inlineSearchInput}
              placeholder="Search stations, cities, countries, genres..."
              placeholderTextColor="#8E8E93"
              value={searchQuery}
              onChangeText={onSearchChange}
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => onSearchChange('')}
                style={styles.clearBtn}
                accessibilityLabel="Clear search input"
              >
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={onOpenSearch}
            style={styles.searchQuickBtn}
            accessibilityLabel="Open global station search"
          >
            <Text style={styles.searchIcon}>⌕</Text>
            <Text style={styles.searchPlaceholderText}>
              Search stations, cities, countries, genres...
            </Text>
            <View style={styles.searchShortcutTag}>
              <Text style={styles.searchShortcutText}>SEARCH</Text>
            </View>
          </TouchableOpacity>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#0A0A0A',
    borderBottomWidth: 1,
    borderBottomColor: '#262626',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#171717',
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#E5E5E5',
    letterSpacing: 0.5,
  },
  utcText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#8E8E93',
  },
  searchQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2E2E2E',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  inlineSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#383838',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    gap: 10,
  },
  inlineSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    height: '100%',
    padding: 0,
  },
  clearBtn: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchIcon: {
    fontSize: 18,
    color: '#8E8E93',
  },
  searchPlaceholderText: {
    flex: 1,
    fontSize: 14,
    color: '#8E8E93',
  },
  searchShortcutTag: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  searchShortcutText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E5E5E5',
    letterSpacing: 0.8,
  },
});
