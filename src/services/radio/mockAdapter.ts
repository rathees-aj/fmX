import { RadioStation, StationBoundingBox } from '../../types/station';
import { RadioDirectoryAdapter, StationQueryOptions } from './types';

/**
 * Verified high-reliability global test stations across multiple continents
 * with genuine live audio streams, exact coordinates, frequencies, and genres.
 */
export const VERIFIED_TEST_STATIONS: RadioStation[] = [
  {
    id: 'somafm-groovesalad',
    name: 'SomaFM Groove Salad',
    tagline: 'Downtempo ambient grooves for chilled minds',
    city: 'San Francisco',
    country: 'United States',
    countryCode: 'US',
    latitude: 37.7749,
    longitude: -122.4194,
    frequency: 'DIGITAL',
    genres: ['Ambient', 'Downtempo', 'Chillout'],
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://somafm.com',
  },
  {
    id: 'kexp-seattle',
    name: 'KEXP 90.3 FM',
    tagline: 'Where the music matters',
    city: 'Seattle',
    country: 'United States',
    countryCode: 'US',
    latitude: 47.6062,
    longitude: -122.3321,
    frequency: '90.3 MHz',
    genres: ['Indie', 'Alternative', 'Electronic'],
    streamUrl: 'https://kexp.streamguys1.com/kexp160.aac',
    bitrate: 160,
    codec: 'AAC',
    homepage: 'https://kexp.org',
  },
  {
    id: 'wnyc-newyork',
    name: 'WNYC 93.9 FM',
    tagline: 'New York public radio and global conversations',
    city: 'New York',
    country: 'United States',
    countryCode: 'US',
    latitude: 40.7128,
    longitude: -74.0060,
    frequency: '93.9 FM',
    genres: ['Public Radio', 'News', 'Culture'],
    streamUrl: 'https://fm939.wnyc.org/wnycfm-web',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://wnyc.org',
  },
  {
    id: 'bbc-world-service',
    name: 'BBC World Service',
    tagline: 'International broadcasting and journalism',
    city: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    latitude: 51.5074,
    longitude: -0.1278,
    frequency: '94.3 MHz',
    genres: ['Global News', 'Documentary', 'Talk'],
    streamUrl: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
    bitrate: 96,
    codec: 'MP3',
    homepage: 'https://bbc.co.uk/worldserviceradio',
  },
  {
    id: 'fip-paris',
    name: 'FIP Radio Paris',
    tagline: 'Eclectic sonic voyage from Radio France',
    city: 'Paris',
    country: 'France',
    countryCode: 'FR',
    latitude: 48.8566,
    longitude: 2.3522,
    frequency: '105.1 FM',
    genres: ['Eclectic', 'Jazz', 'World', 'Soundtrack'],
    streamUrl: 'https://icecast.radiofrance.fr/fip-midfi.mp3',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://radiofrance.fr/fip',
  },
  {
    id: 'fluxfm-berlin',
    name: 'FluxFM Berlin',
    tagline: 'Die Alternative im Radio — Berlin indie sound',
    city: 'Berlin',
    country: 'Germany',
    countryCode: 'DE',
    latitude: 52.5200,
    longitude: 13.4050,
    frequency: '100.6 MHz',
    genres: ['Indie Rock', 'Electro', 'Subculture'],
    streamUrl: 'https://fluxfm.streamguys1.com/fluxfm-live',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://fluxfm.de',
  },
  {
    id: 'swissgroove-zurich',
    name: 'SwissGroove Radio',
    tagline: 'Continuous jazz, funk, soul and world groove',
    city: 'Zurich',
    country: 'Switzerland',
    countryCode: 'CH',
    latitude: 47.3769,
    longitude: 8.5417,
    frequency: 'DIGITAL',
    genres: ['Jazz Funk', 'Soul', 'Deep Groove'],
    streamUrl: 'https://stream.swissgroove.ch/swissgroove',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://swissgroove.ch',
  },
  {
    id: 'ibiza-global',
    name: 'Ibiza Global Radio',
    tagline: 'Electronic music direct from the Balearic islands',
    city: 'Ibiza',
    country: 'Spain',
    countryCode: 'ES',
    latitude: 38.9067,
    longitude: 1.4206,
    frequency: '100.8 FM',
    genres: ['Deep House', 'Techno', 'Balearic'],
    streamUrl: 'https://listens.ibizaglobalradio.com:8024/ibizaglobalradio.mp3',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://ibizaglobalradio.com',
  },
  {
    id: 'sublime-amsterdam',
    name: 'Sublime FM',
    tagline: 'Fresh jazz, funk & soul from Amsterdam',
    city: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    latitude: 52.3676,
    longitude: 4.9041,
    frequency: '90.7 FM',
    genres: ['Funk', 'Soul', 'Contemporary Jazz'],
    streamUrl: 'https://stream.sublime.nl/sublime',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://sublime.nl',
  },
  {
    id: 'tokyo-listenmoe',
    name: 'Listen.moe Tokyo',
    tagline: 'Community curated Japanese music and city soundscapes',
    city: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    latitude: 35.6762,
    longitude: 139.6503,
    frequency: 'DIGITAL',
    genres: ['J-Pop', 'City Pop', 'Anime'],
    streamUrl: 'https://listen.moe/stream',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://listen.moe',
  },
  {
    id: 'triplej-sydney',
    name: 'triple j ABC',
    tagline: 'We love Australian music',
    city: 'Sydney',
    country: 'Australia',
    countryCode: 'AU',
    latitude: -33.8688,
    longitude: 151.2093,
    frequency: '105.7 FM',
    genres: ['Alternative Rock', 'Hip Hop', 'Indie'],
    streamUrl: 'https://live-radio01.mediahubaustralia.com/2TJW/mp3',
    bitrate: 96,
    codec: 'MP3',
    homepage: 'https://abc.net.au/triplej',
  },
  {
    id: 'pbs-melbourne',
    name: 'PBS 106.7 FM',
    tagline: 'Melbourne independent community broadcasting',
    city: 'Melbourne',
    country: 'Australia',
    countryCode: 'AU',
    latitude: -37.8136,
    longitude: 144.9631,
    frequency: '106.7 FM',
    genres: ['Blues', 'Roots', 'Post-Punk'],
    streamUrl: 'https://stream.pbsfm.org.au:8443/pbsfm_live',
    bitrate: 128,
    codec: 'MP3',
    homepage: 'https://pbsfm.org.au',
  },
];

export class MockRadioAdapter implements RadioDirectoryAdapter {
  readonly name = 'MockDirectoryAdapter';
  private stations = VERIFIED_TEST_STATIONS;

  async getCuratedStations(): Promise<RadioStation[]> {
    return [...this.stations];
  }

  async searchStations(options: StationQueryOptions | string, limit = 20): Promise<RadioStation[]> {
    const q = (typeof options === 'string' ? options : options.query || '').trim().toLowerCase();
    const effectiveLimit = typeof options === 'object' && options.limit ? options.limit : limit;
    if (!q) return this.stations.slice(0, effectiveLimit);

    return this.stations
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          s.country.toLowerCase().includes(q) ||
          s.genres.some((g) => g.toLowerCase().includes(q))
      )
      .slice(0, effectiveLimit);
  }

  async getStationsInBounds(bounds: StationBoundingBox, limit = 15): Promise<RadioStation[]> {
    return this.stations
      .filter((s) => {
        const withinLat = s.latitude >= bounds.minLat && s.latitude <= bounds.maxLat;
        const withinLng = s.longitude >= bounds.minLng && s.longitude <= bounds.maxLng;
        return withinLat && withinLng;
      })
      .slice(0, limit);
  }

  async getStationById(id: string): Promise<RadioStation | null> {
    const station = this.stations.find((s) => s.id === id);
    return station ? { ...station } : null;
  }
}
