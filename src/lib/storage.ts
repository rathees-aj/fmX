import AsyncStorage from '@react-native-async-storage/async-storage';
import { RadioStation } from '../types/station';

const FAVORITES_KEY = '@fmx:favorites_v2';
const RECENTS_KEY = '@fmx:recent_history_v2';
const MAX_RECENTS = 60;

/**
 * Local asynchronous persistence for favorites and recently played stations.
 * Operates completely offline, requires no backend or user account,
 * preserves state across app restarts, and degrades gracefully on storage errors.
 */
export const localFavoritesStorage = {
  async getFavorites(): Promise<string[]> {
    try {
      const raw = await AsyncStorage.getItem(FAVORITES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[fmX Storage] Failed to load favorites:', err);
      return [];
    }
  },

  async toggleFavorite(stationId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      const exists = favorites.includes(stationId);
      const updated = exists
        ? favorites.filter((id) => id !== stationId)
        : [stationId, ...favorites];
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      return !exists;
    } catch (err) {
      console.warn('[fmX Storage] Failed to toggle favorite:', err);
      return false;
    }
  },

  async isFavorite(stationId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      return favorites.includes(stationId);
    } catch {
      return false;
    }
  },

  async removeFavorite(stationId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const updated = favorites.filter((id) => id !== stationId);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    } catch {}
  },
};

export const localHistoryStorage = {
  async getRecentStations(): Promise<RadioStation[]> {
    try {
      const raw = await AsyncStorage.getItem(RECENTS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn('[fmX Storage] Failed to load recent stations:', err);
      return [];
    }
  },

  async addRecentStation(station: RadioStation): Promise<void> {
    if (!station || !station.id) return;
    try {
      const recents = await this.getRecentStations();
      // Remove any prior entry of this station to avoid duplicates, and prepend
      const filtered = recents.filter((s) => s.id !== station.id);
      const updated = [station, ...filtered].slice(0, MAX_RECENTS);
      await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    } catch (err) {
      console.warn('[fmX Storage] Failed to record recent station:', err);
    }
  },

  async clearRecentStations(): Promise<void> {
    try {
      await AsyncStorage.removeItem(RECENTS_KEY);
    } catch (err) {
      console.warn('[fmX Storage] Failed to clear recents:', err);
    }
  },
};
