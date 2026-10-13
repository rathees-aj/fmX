import AsyncStorage from '@react-native-async-storage/async-storage';
import { RadioStation } from '../../types/station';

const HEALTH_STORAGE_KEY = '@fmx:stream_health_v1';
const FAILURE_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes before retrying known-failing endpoint

export interface StreamHealthRecord {
  lastFailureTime: number;
  failureCount: number;
  lastErrorMessage?: string;
  isConfirmedHealthy?: boolean;
}

export class StreamHealthTracker {
  private static instance: StreamHealthTracker;
  private healthMap: Map<string, StreamHealthRecord> = new Map();
  private initialized = false;

  private constructor() {
    this.loadPersistedHealth();
  }

  public static getInstance(): StreamHealthTracker {
    if (!StreamHealthTracker.instance) {
      StreamHealthTracker.instance = new StreamHealthTracker();
    }
    return StreamHealthTracker.instance;
  }

  private async loadPersistedHealth() {
    try {
      const raw = await AsyncStorage.getItem(HEALTH_STORAGE_KEY);
      if (raw) {
        const parsed: Record<string, StreamHealthRecord> = JSON.parse(raw);
        const now = Date.now();
        for (const [url, record] of Object.entries(parsed)) {
          // Only retain records within cooldown window
          if (now - record.lastFailureTime < FAILURE_COOLDOWN_MS * 2) {
            this.healthMap.set(url, record);
          }
        }
      }
      this.initialized = true;
    } catch {
      this.initialized = true;
    }
  }

  private async persistHealth() {
    try {
      const obj: Record<string, StreamHealthRecord> = {};
      const now = Date.now();
      for (const [url, record] of this.healthMap.entries()) {
        if (now - record.lastFailureTime < FAILURE_COOLDOWN_MS * 2) {
          obj[url] = record;
        }
      }
      await AsyncStorage.setItem(HEALTH_STORAGE_KEY, JSON.stringify(obj));
    } catch {}
  }

  /**
   * Validate URL format and protocol without aggressive network probing
   */
  public isValidStreamUrl(url: string | undefined | null): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    try {
      const parsed = new URL(trimmed);
      return Boolean(parsed.hostname && parsed.hostname.length > 3);
    } catch {
      // In React Native / mobile without full URL parser, check basic regex
      return /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/i.test(trimmed);
    }
  }

  /**
   * Check if a stream URL is in a failure cooldown
   */
  public isStreamFailing(url: string): boolean {
    const record = this.healthMap.get(url);
    if (!record) return false;
    if (record.isConfirmedHealthy) return false;

    const elapsed = Date.now() - record.lastFailureTime;
    return elapsed < FAILURE_COOLDOWN_MS;
  }

  /**
   * Record that a stream endpoint failed during playback
   */
  public recordStreamFailure(url: string, errorMessage?: string): void {
    if (!url) return;
    const existing = this.healthMap.get(url);
    const count = (existing?.failureCount || 0) + 1;

    this.healthMap.set(url, {
      lastFailureTime: Date.now(),
      failureCount: count,
      lastErrorMessage: errorMessage,
      isConfirmedHealthy: false,
    });

    this.persistHealth();
  }

  /**
   * Record that a stream endpoint succeeded and is playing cleanly
   */
  public recordStreamSuccess(url: string): void {
    if (!url) return;
    this.healthMap.set(url, {
      lastFailureTime: 0,
      failureCount: 0,
      isConfirmedHealthy: true,
    });

    this.persistHealth();
  }

  /**
   * Evaluate station status based on URL validity and recent health records
   */
  public evaluateStationHealth(station: RadioStation): 'healthy' | 'failing' | 'untested' {
    if (!this.isValidStreamUrl(station.streamUrl)) {
      return 'failing';
    }
    const record = this.healthMap.get(station.streamUrl);
    if (!record) return 'untested';
    if (this.isStreamFailing(station.streamUrl)) return 'failing';
    if (record.isConfirmedHealthy) return 'healthy';
    return 'untested';
  }
}

export const streamHealthTracker = StreamHealthTracker.getInstance();
