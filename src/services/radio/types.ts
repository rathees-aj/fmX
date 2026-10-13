import { RadioStation, StationBoundingBox } from '../../types/station';

export interface StationQueryOptions {
  query?: string;
  name?: string;
  countryCode?: string;
  country?: string;
  state?: string;
  tag?: string;
  language?: string;
  codec?: string;
  hasGeoOnly?: boolean;
  order?: 'votes' | 'clickcount' | 'name' | 'changetimestamp' | 'random';
  reverse?: boolean;
  offset?: number;
  limit?: number;
  bounds?: StationBoundingBox;
}

export interface RadioDirectoryAdapter {
  readonly name: string;
  getCuratedStations(limit?: number): Promise<RadioStation[]>;
  searchStations(options: StationQueryOptions | string): Promise<RadioStation[]>;
  getStationsInBounds(bounds: StationBoundingBox, limit?: number): Promise<RadioStation[]>;
  getStationById(id: string): Promise<RadioStation | null>;
  getStationsByCountryCode?(countryCode: string, limit?: number, offset?: number): Promise<RadioStation[]>;
  getStationsByLanguage?(language: string, limit?: number, offset?: number): Promise<RadioStation[]>;
  getStationsByTag?(tag: string, limit?: number, offset?: number): Promise<RadioStation[]>;
  getTopVotedStations?(limit?: number, offset?: number): Promise<RadioStation[]>;
  getTopClickedStations?(limit?: number, offset?: number): Promise<RadioStation[]>;
  getRecentlyUpdatedStations?(limit?: number, offset?: number): Promise<RadioStation[]>;
  resolveStreamUrl?(stationUuid: string): Promise<string | null>;
  getAllStations?(limit?: number, offset?: number): Promise<RadioStation[]>;
  getCountryCodes?(limit?: number): Promise<Array<{ code: string; stationCount: number }>>;
  getCountries?(limit?: number): Promise<Array<{ name: string; code: string; stationCount: number }>>;
  getLanguages?(limit?: number): Promise<Array<{ name: string; stationCount: number }>>;
  getTags?(limit?: number): Promise<Array<{ name: string; stationCount: number }>>;
}
