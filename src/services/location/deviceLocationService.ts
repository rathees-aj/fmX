import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface DeviceLocationResult {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  areaLabel?: string | null;
  isLastKnown?: boolean;
}

export type LocationServiceStatus =
  | 'idle'
  | 'requesting_permission'
  | 'locating'
  | 'ready'
  | 'permission_denied'
  | 'services_disabled'
  | 'timeout'
  | 'error';

export interface LocationState {
  status: LocationServiceStatus;
  location: DeviceLocationResult | null;
  errorMessage: string | null;
}

export class DeviceLocationService {
  private cachedLocation: DeviceLocationResult | null = null;
  private lastFetchTimestamp = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Checks current permission status without prompting user.
   */
  async checkPermission(): Promise<Location.PermissionStatus> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch {
      return Location.PermissionStatus.UNDETERMINED;
    }
  }

  /**
   * Prompts user for foreground location permission with explicit explanation.
   */
  async requestPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === Location.PermissionStatus.GRANTED;
    } catch {
      return false;
    }
  }

  /**
   * Reverse geocodes coordinates to a high-level area label (e.g., "Seattle, Washington" or "Chennai, Tamil Nadu").
   * Never fabricates unverified labels.
   */
  async getAreaLabel(latitude: number, longitude: number): Promise<string | null> {
    try {
      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (places && places.length > 0) {
        const p = places[0];
        const city = p.city || p.district || p.subregion;
        const region = p.region || p.subregion;
        const country = p.country;

        const parts = [city, region, country].filter(Boolean);
        // Eliminate duplicates
        const unique = parts.filter((item, idx) => parts.indexOf(item) === idx);
        return unique.length > 0 ? unique.join(', ') : null;
      }
    } catch {
      // Reverse geocoding can fail offline or on web; non-fatal
    }
    return null;
  }

  /**
   * Obtains listener device position.
   * Prefers recent last-known location first for instantaneous response, then resolves current position.
   */
  async getDeviceLocation(forceRefresh = false): Promise<DeviceLocationResult> {
    // 1. Check in-memory cache if not forced
    if (
      !forceRefresh &&
      this.cachedLocation &&
      Date.now() - this.lastFetchTimestamp < this.CACHE_TTL_MS
    ) {
      return this.cachedLocation;
    }

    // 2. Check if location services are enabled on device
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled && Platform.OS !== 'web') {
        throw new Error('Location services are disabled on this device. Please enable GPS in device settings.');
      }
    } catch (err: any) {
      if (err.message?.includes('disabled')) throw err;
    }

    // 3. Verify / Request foreground permission
    let hasPermission = false;
    const currentStatus = await this.checkPermission();
    if (currentStatus === Location.PermissionStatus.GRANTED) {
      hasPermission = true;
    } else {
      hasPermission = await this.requestPermission();
    }

    if (!hasPermission) {
      throw new Error('Location permission denied. Allow fmX location access to discover stations near you.');
    }

    // 4. Try fast last-known position first if available
    let coords: { latitude: number; longitude: number; accuracy?: number | null } | null = null;
    let isLastKnown = false;

    if (!forceRefresh) {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 120000, // 2 minutes
        });
        if (lastKnown?.coords) {
          coords = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            accuracy: lastKnown.coords.accuracy,
          };
          isLastKnown = true;
        }
      } catch {}
    }

    // 5. If no last known, request current position with bounded timeout
    if (!coords) {
      const positionPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Location request timed out. Please check signal or retry.')), 10000)
      );

      const current = await Promise.race([positionPromise, timeoutPromise]);
      coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        accuracy: current.coords.accuracy,
      };
      isLastKnown = false;
    }

    // 6. Reverse geocode high-level area label
    const areaLabel = await this.getAreaLabel(coords.latitude, coords.longitude);

    const result: DeviceLocationResult = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      areaLabel,
      isLastKnown,
    };

    this.cachedLocation = result;
    this.lastFetchTimestamp = Date.now();

    return result;
  }
}

export const deviceLocationService = new DeviceLocationService();
