import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors } from '../../theme/colors';

export type NavTab = 'explore' | 'countries' | 'search' | 'mystations' | 'saved';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  savedCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  savedCount,
}) => {
  const tabs: { id: NavTab; label: string; icon: string; badge?: number }[] = [
    { id: 'explore', label: 'Explore', icon: '◎' },
    { id: 'countries', label: 'Countries', icon: '🌐' },
    { id: 'search', label: 'Search', icon: '⌕' },
    { id: 'mystations', label: 'My Stations', icon: '☷' },
    { id: 'saved', label: 'Saved', icon: '★', badge: savedCount },
  ];

  return (
    <View style={styles.navBar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            activeOpacity={0.7}
            onPress={() => onSelectTab(tab.id)}
            style={[styles.tabBtn, isActive && styles.tabBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${tab.label} tab`}
          >
            <View style={styles.iconContainer}>
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {tab.icon}
              </Text>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]} numberOfLines={1}>
              {tab.label}
            </Text>

            {isActive && <View style={styles.activeIndicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    height: 60,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#262626',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    zIndex: 90,
  },
  tabBtn: {
    flex: 1,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingVertical: 4,
    gap: 3,
  },
  tabBtnActive: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIcon: {
    fontSize: 18,
    color: '#8E8E93',
  },
  tabIconActive: {
    color: '#FFFFFF',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
  },
  badgePill: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#000000',
    fontSize: 9,
    fontWeight: '800',
  },
});
