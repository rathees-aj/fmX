import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Platform, useWindowDimensions } from 'react-native';
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
  const { width } = useWindowDimensions();
  const [utcTime, setUtcTime] = useState('');

  const isSmallMobile = width < 360;
  const isMobile = width < 480;
  const showUtcClock = width >= 440;
  const logoSize = isSmallMobile ? 32 : isMobile ? 36 : 40;

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

  const searchPlaceholder =
    width < 360
      ? 'Search stations...'
      : width < 440
      ? 'Search stations, genres...'
      : 'Search stations, cities, countries, genres...';

  return (
    <View style={styles.header}>
      {/* Brand Identity Row */}
      <View style={styles.brandRow}>
        <View style={styles.logoWrap}>
          <FmXLogo size={logoSize} showWordmark={true} />
        </View>

        <View style={[styles.metaGroup, isMobile && styles.metaGroupMobile]}>
          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={[styles.apkBadge, isSmallMobile && styles.apkBadgeCompact]}
              onPress={() => {
                if (typeof window !== 'undefined') {
                  const a = document.createElement('a');
                  a.href = '/fmx-radio.apk';
                  a.download = 'fmX-Global-Radio.apk';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              accessibilityRole="button"
              accessibilityLabel="Download Android App APK"
            >
              <Text style={styles.apkIcon}>↓</Text>
              <Text style={styles.apkText}>{isSmallMobile ? 'APP' : 'GET APP'}</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.stationBadge, isSmallMobile && styles.stationBadgeCompact]}>
            <View style={styles.liveDot} />
            <Text style={styles.badgeText} numberOfLines={1}>
              {stationCount > 0 ? (isSmallMobile ? `${stationCount}` : `${stationCount} ON AIR`) : 'LIVE'}
            </Text>
          </View>

          {showUtcClock && (
            <Text style={styles.utcText} numberOfLines={1}>
              {utcTime}
            </Text>
          )}
        </View>
      </View>

      {/* Quick Search Action Bar */}
      {showSearchBar && (
        showInlineSearch && onSearchChange ? (
          <View style={styles.inlineSearchContainer}>
            <Text style={styles.searchIcon}>⌕</Text>
            <TextInput
              style={styles.inlineSearchInput}
              placeholder={searchPlaceholder}
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
            <Text style={styles.searchPlaceholderText} numberOfLines={1} ellipsizeMode="tail">
              {searchPlaceholder}
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
    gap: 10,
    width: '100%',
    maxWidth: '100%',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: '100%',
    gap: 8,
  },
  logoWrap: {
    flexShrink: 0,
    justifyContent: 'center',
  },
  metaGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  metaGroupMobile: {
    gap: 6,
  },
  apkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    flexShrink: 0,
  },
  apkBadgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  apkIcon: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
  },
  apkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
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
    flexShrink: 0,
  },
  stationBadgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
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
    flexShrink: 0,
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
    width: '100%',
    maxWidth: '100%',
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
    width: '100%',
    maxWidth: '100%',
  },
  inlineSearchInput: {
    flex: 1,
    minWidth: 0,
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
    flexShrink: 0,
  },
  clearBtnText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchIcon: {
    fontSize: 18,
    color: '#8E8E93',
    flexShrink: 0,
  },
  searchPlaceholderText: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: '#8E8E93',
  },
  searchShortcutTag: {
    backgroundColor: '#262626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexShrink: 0,
  },
  searchShortcutText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E5E5E5',
    letterSpacing: 0.8,
  },
});
