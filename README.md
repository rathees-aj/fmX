# fmX — Global Radio Player

fmX is a modern, accessible global internet radio player built with Expo, React Native, and TypeScript for Web, iOS, and Android. It delivers discovery across 60,000+ worldwide broadcasters powered by the community-maintained Radio Browser API, featuring local device persistence without accounts or logins, and a monochrome dark aesthetic.

## Architecture

- **Core Framework**: Expo SDK 52 / React Native with cross-platform web support (`react-native-web`).
- **Discovery Infrastructure**: Multi-endpoint Radio Browser adapter with automatic DNS mirror failover, in-memory LRU caching, and request abort controllers.
- **Audio Engine**: `AudioPlaybackEngine` supporting native audio streams (`expo-av`) on iOS/Android and HTML5 Audio with `hls.js` for HLS streams (`.m3u8`) on the web.
- **State & Navigation**: 5 primary navigation tabs:
  1. **Explore**: Regional & genre filtering, featured stations, responsive two-column desktop browsing layout, and station cards.
  2. **Countries**: Hierarchical geographic exploration (`Country → State/Region → City → Station`) backed by real directory metadata.
  3. **Search**: Multi-field global search across station names, cities, regions, countries, languages, and genres with debounced requests and pagination.
  4. **My Stations**: Personal listening rotation stored locally on the user's device.
  5. **Saved**: Bookmarked favorites persisted locally using `AsyncStorage`. No accounts, logins, or cloud databases required.
- **Design System**: Strict high-contrast monochrome (`pureBlack`, `charcoal`, `graphite`, `silver`, `offWhite`, `white`) with readable typography (~16px body, wrapping station titles, minimum 44×44px touch targets).

## Key Removals & Simplifications

- **Three.js & 3D Globe**: Completely removed Three.js globe rendering, globe HTML, camera controls, pins, textures, and assets.
- **Google Maps & Places**: Completely removed Google Maps, Places, Geocoding, and location enrichment services.
- **Profile & Auth**: Removed user accounts, Supabase dependencies, sign-in/up flows, and profile management. All user preferences remain 100% local.

## Setup & Development

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Start web preview
npx expo start --web

# Type check
npx tsc --noEmit

# Run unit tests
node --test test/station_and_globe.test.js

# Build production web bundle
npx expo export --platform web
```
