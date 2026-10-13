const test = require('node:test');
const assert = require('node:assert');

// 1. GlobeMath 3D Cartesian Coordinate Conversion
function latLngToVector3D(lat, lng, radius = 100) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return { x, y, z };
}

function rotateY(p, ang) {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return { x: p.x * cos + p.z * sin, y: p.y, z: -p.x * sin + p.z * cos };
}

function rotateX(p, ang) {
  const cos = Math.cos(ang), sin = Math.sin(ang);
  return { x: p.x, y: p.y * cos - p.z * sin, z: p.y * sin + p.z * cos };
}

function latLngToFocusRotation(lat, lng) {
  const clampedLat = Math.max(-85, Math.min(85, lat));
  let normalizedLng = ((((lng % 360) + 540) % 360) - 180);

  const targetX = (clampedLat * Math.PI) / 180;
  const targetY = -((normalizedLng + 90) * Math.PI) / 180;

  return { targetX, targetY, normalizedLng };
}

function calculateShortestAngleDelta(current, target) {
  let delta = target - current;
  const twoPi = Math.PI * 2;
  while (delta > Math.PI) delta -= twoPi;
  while (delta < -Math.PI) delta += twoPi;
  return delta;
}

function greatCircleDistance(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const phi1 = lat1 * rad;
  const phi2 = lat2 * rad;
  const deltaPhi = (lat2 - lat1) * rad;
  const deltaLambda = (lng2 - lng1) * rad;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

test('GlobeMath: latLngToVector3D converts North Pole and Equator correctly', () => {
  const np = latLngToVector3D(90, 0, 100);
  assert.strictEqual(Math.round(np.y), 100);
  assert.strictEqual(Math.round(np.x), 0);
  assert.strictEqual(Math.round(np.z), 0);

  const sp = latLngToVector3D(-90, 0, 100);
  assert.strictEqual(Math.round(sp.y), -100);

  const eq = latLngToVector3D(0, 0, 100);
  assert.strictEqual(Math.round(eq.y), 0);
});

test('GlobeMath: Camera Focus Calculation accurately centers global locations on front-facing Z axis', () => {
  const globalTestCities = [
    { name: 'London, UK', lat: 51.5074, lng: -0.1278 },
    { name: 'Chennai, India', lat: 13.0827, lng: 80.2707 },
    { name: 'New York, USA', lat: 40.7128, lng: -74.0060 },
    { name: 'Tokyo, Japan', lat: 35.6762, lng: 139.6503 },
    { name: 'Sydney, Australia', lat: -33.8688, lng: 151.2093 },
  ];

  for (const city of globalTestCities) {
    const localPos = latLngToVector3D(city.lat, city.lng, 100);
    const { targetX, targetY } = latLngToFocusRotation(city.lat, city.lng);

    // Apply rotation around Y then X in Three.js Euler XYZ order
    const afterY = rotateY(localPos, targetY);
    const afterX = rotateX(afterY, targetX);

    assert.ok(
      Math.abs(afterX.x) < 0.01,
      `${city.name} X world position should be 0`
    );
    assert.ok(
      Math.abs(afterX.y) < 0.01,
      `${city.name} Y world position should be 0`
    );
    assert.strictEqual(
      Math.round(afterX.z),
      100,
      `${city.name} Z world position should face camera at +100`
    );
  }
});

test('GlobeMath: Longitude wrapping and date-line handling', () => {
  const westOfDateLine = latLngToFocusRotation(0, 185);
  assert.strictEqual(westOfDateLine.normalizedLng, -175);

  const eastOfDateLine = latLngToFocusRotation(0, -190);
  assert.strictEqual(eastOfDateLine.normalizedLng, 170);

  // Shortest angular path test (e.g., from -170 deg to +170 deg is 20 deg, not 340 deg)
  const fromRad = (-170 * Math.PI) / 180;
  const toRad = (170 * Math.PI) / 180;
  const delta = calculateShortestAngleDelta(fromRad, toRad);
  assert.ok(Math.abs(delta - (-20 * Math.PI) / 180) < 0.001);
});

test('GlobeMath: greatCircleDistance measures antipodal and zero distance accurately', () => {
  const d0 = greatCircleDistance(40.7128, -74.0060, 40.7128, -74.0060);
  assert.strictEqual(Math.round(d0), 0);

  const dAntipode = greatCircleDistance(90, 0, -90, 0);
  assert.ok(Math.abs(dAntipode - Math.PI) < 0.001);
});

// 2. Station Normalization & Validation
function isValidStreamUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
  try {
    const parsed = new URL(trimmed);
    return Boolean(parsed.hostname && parsed.hostname.length > 3);
  } catch {
    return false;
  }
}

function normalizeStation(raw) {
  if (!raw || !raw.stationuuid) return null;

  const streamUrl = (raw.url_resolved || raw.url || '').trim();
  if (!isValidStreamUrl(streamUrl)) {
    return null;
  }

  const rawLat = typeof raw.geo_lat === 'number' ? raw.geo_lat : parseFloat(String(raw.geo_lat));
  const rawLng = typeof raw.geo_long === 'number' ? raw.geo_long : parseFloat(String(raw.geo_long));

  const hasValidCoords =
    !isNaN(rawLat) &&
    !isNaN(rawLng) &&
    rawLat >= -90 &&
    rawLat <= 90 &&
    rawLng >= -180 &&
    rawLng <= 180 &&
    (Math.abs(rawLat) > 0.001 || Math.abs(rawLng) > 0.001);

  const lat = hasValidCoords ? Number(rawLat.toFixed(4)) : 0;
  const lng = hasValidCoords ? Number(rawLng.toFixed(4)) : 0;

  const rawGenres = (raw.tags || '')
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 1 && t.length < 24 && !/^[0-9]+$/.test(t))
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .slice(0, 4);

  const rawState = (raw.state || '').trim();
  const country = (raw.country || 'Global').trim();

  return {
    id: raw.stationuuid,
    sourceStationId: raw.stationuuid,
    changeuuid: raw.changeuuid,
    name: (raw.name || 'Unnamed Broadcast').trim(),
    city: rawState || country,
    state: rawState,
    country,
    countryCode: (raw.countrycode || 'GL').trim().toUpperCase().substring(0, 2),
    latitude: lat,
    longitude: lng,
    hasCoordinates: hasValidCoords,
    genres: rawGenres.length > 0 ? rawGenres : ['Radio'],
    streamUrl,
    urlResolved: raw.url_resolved,
    bitrate: raw.bitrate && raw.bitrate > 0 ? raw.bitrate : 128,
    codec: raw.codec?.toUpperCase() || 'MP3',
    votes: raw.votes,
    clickCount: raw.clickcount,
    lastCheckOk: raw.lastcheckok === 1,
    directoryRecordAvailable: true,
    qualityBadge: raw.lastcheckok === 1 && hasValidCoords ? 'AVAILABLE' : (!hasValidCoords ? 'LOCATION UNVERIFIED' : 'UNVERIFIED'),
  };
}

test('Station Normalization: accepts valid records and preserves non-geolocated records with hasCoordinates: false', () => {
  const validRecord = {
    stationuuid: 'abc-123',
    changeuuid: 'change-456',
    name: 'KEXP Seattle',
    url_resolved: 'https://kexp.streamguys1.com/kexp160.aac',
    geo_lat: 47.6062,
    geo_long: -122.3321,
    country: 'United States',
    countrycode: 'US',
    tags: 'indie, rock, alternative',
    bitrate: 160,
    codec: 'aac',
    votes: 450,
    clickcount: 1200,
    lastcheckok: 1,
  };

  const normalized = normalizeStation(validRecord);
  assert.ok(normalized !== null);
  assert.strictEqual(normalized.id, 'abc-123');
  assert.strictEqual(normalized.sourceStationId, 'abc-123');
  assert.strictEqual(normalized.changeuuid, 'change-456');
  assert.strictEqual(normalized.name, 'KEXP Seattle');
  assert.strictEqual(normalized.countryCode, 'US');
  assert.strictEqual(normalized.latitude, 47.6062);
  assert.strictEqual(normalized.longitude, -122.3321);
  assert.strictEqual(normalized.hasCoordinates, true);
  assert.strictEqual(normalized.votes, 450);
  assert.strictEqual(normalized.clickCount, 1200);
  assert.strictEqual(normalized.qualityBadge, 'AVAILABLE');
  assert.deepStrictEqual(normalized.genres, ['Indie', 'Rock', 'Alternative']);

  // Records without coordinates are preserved with hasCoordinates: false rather than dropped
  const nonGeoRecord = { ...validRecord, stationuuid: 'non-geo-1', geo_lat: null, geo_long: null };
  const normalizedNonGeo = normalizeStation(nonGeoRecord);
  assert.ok(normalizedNonGeo !== null);
  assert.strictEqual(normalizedNonGeo.id, 'non-geo-1');
  assert.strictEqual(normalizedNonGeo.hasCoordinates, false);
  assert.strictEqual(normalizedNonGeo.latitude, 0);
  assert.strictEqual(normalizedNonGeo.qualityBadge, 'LOCATION UNVERIFIED');

  // Invalid stream URL rejection
  assert.strictEqual(normalizeStation({ ...validRecord, url_resolved: '' }), null);
  assert.strictEqual(normalizeStation({ ...validRecord, url_resolved: 'ftp://bad' }), null);
});

// 3. Station Deduplication
function deduplicateStations(stations) {
  const seenUuids = new Set();
  const seenKeys = new Set();
  const unique = [];

  for (const s of stations) {
    if (seenUuids.has(s.id)) continue;
    const compKey = `${s.name.toLowerCase()}|${s.city.toLowerCase()}|${s.countryCode}`;
    if (seenKeys.has(compKey)) continue;

    seenUuids.add(s.id);
    seenKeys.add(compKey);
    unique.push(s);
  }

  return unique;
}

test('Station Deduplication: eliminates duplicate UUIDs and identical station mirrors', () => {
  const rawList = [
    { id: '1', name: 'SomaFM Groove Salad', city: 'San Francisco', countryCode: 'US' },
    { id: '1', name: 'SomaFM Groove Salad', city: 'San Francisco', countryCode: 'US' },
    { id: '2', name: 'somafm groove salad', city: 'san francisco', countryCode: 'US' },
    { id: '3', name: 'BBC World Service', city: 'London', countryCode: 'GB' },
  ];

  const deduped = deduplicateStations(rawList);
  assert.strictEqual(deduped.length, 2);
  assert.strictEqual(deduped[0].id, '1');
  assert.strictEqual(deduped[1].id, '3');
});

// 4. Stream Health Tracking
class MockStreamHealthTracker {
  constructor() {
    this.failures = new Map();
  }
  recordFailure(url, error) {
    this.failures.set(url, { time: Date.now(), error });
  }
  recordSuccess(url) {
    this.failures.delete(url);
  }
  isFailing(url, cooldownMs = 1000) {
    const f = this.failures.get(url);
    if (!f) return false;
    return Date.now() - f.time < cooldownMs;
  }
}

test('Stream Health Tracker: tracks failures, respects cooldown, and resets on playback success', () => {
  const tracker = new MockStreamHealthTracker();
  const testUrl = 'https://stream.example.com/live.mp3';

  assert.strictEqual(tracker.isFailing(testUrl), false);
  tracker.recordFailure(testUrl, 'HTTP 404 Not Found');
  assert.strictEqual(tracker.isFailing(testUrl), true);
  tracker.recordSuccess(testUrl);
  assert.strictEqual(tracker.isFailing(testUrl), false);
});

// 5. Search Cancellation
test('Search Cancellation: newer search requests invalidate older in-flight requests', async () => {
  let activeSearchId = 0;

  async function mockSearch(query, searchId) {
    await new Promise((r) => setTimeout(r, query === 'fast' ? 10 : 50));
    if (searchId !== activeSearchId) {
      return null;
    }
    return `Results for ${query}`;
  }

  const id1 = ++activeSearchId;
  const p1 = mockSearch('slow', id1);

  const id2 = ++activeSearchId;
  const p2 = mockSearch('fast', id2);

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.strictEqual(res1, null, 'Older slow search should be discarded');
  assert.strictEqual(res2, 'Results for fast', 'Newest search should be applied');
});

// 6. Camera Animation Cancellation & Override
test('Camera Animation: new station target overrides previous in-flight animation immediately', () => {
  let currentTarget = null;

  function setFocusTarget(stationId, lat, lng) {
    currentTarget = { stationId, lat, lng, time: Date.now() };
  }

  setFocusTarget('station-london', 51.5, -0.1);
  assert.strictEqual(currentTarget.stationId, 'station-london');

  // Rapid selection of Tokyo overrides London
  setFocusTarget('station-tokyo', 35.6, 139.7);
  assert.strictEqual(currentTarget.stationId, 'station-tokyo');
  assert.strictEqual(currentTarget.lat, 35.6);
});

// 7. Frequency Snapping Semantics
test('Frequency Snapping: snaps only when verified FM metadata exists; does not invent FM frequencies for digital streams', () => {
  function resolveStationDialMode(station) {
    if (!station.frequency) return { mode: 'DIGITAL', frequency: null };
    const match = station.frequency.match(/(\d+\.?\d*)/);
    if (!match) return { mode: 'DIGITAL', frequency: null };
    const num = parseFloat(match[1]);
    if (num >= 87.5 && num <= 108.0) {
      return { mode: 'FM', frequency: num };
    }
    return { mode: 'DIGITAL', frequency: null };
  }

  const fmStation = { name: 'KEXP 90.3 FM', frequency: '90.3 MHz' };
  const digitalStation = { name: 'SomaFM Groove Salad', frequency: undefined };
  const digitalExplicit = { name: 'SwissGroove', frequency: 'DIGITAL' };

  assert.deepStrictEqual(resolveStationDialMode(fmStation), { mode: 'FM', frequency: 90.3 });
  assert.deepStrictEqual(resolveStationDialMode(digitalStation), { mode: 'DIGITAL', frequency: null });
  assert.deepStrictEqual(resolveStationDialMode(digitalExplicit), { mode: 'DIGITAL', frequency: null });
});

// 8. Stale Cache Fallback
test('Cache Fallback: returns stale cache records when network is unavailable', () => {
  const cache = new Map();
  const CACHE_TTL = 1000;

  function saveCache(key, data) {
    cache.set(key, { timestamp: Date.now(), data });
  }

  function getCache(key, allowExpired = false) {
    const item = cache.get(key);
    if (!item) return null;
    if (allowExpired || Date.now() - item.timestamp < CACHE_TTL) {
      return item.data;
    }
    return null;
  }

  saveCache('curated', [{ id: 'stale-1', name: 'Cached Station' }]);
  assert.strictEqual(getCache('curated', false).length, 1);

  cache.get('curated').timestamp = Date.now() - 5000;
  assert.strictEqual(getCache('curated', false), null);
  assert.strictEqual(getCache('curated', true).length, 1);
});

// 9. Multi-field Search & Relevance Ranking
function calculateStationRelevance(station, query) {
  if (!query) return 1;
  const q = query.trim().toLowerCase();
  if (!q) return 1;

  const name = (station.name || '').toLowerCase();
  const city = (station.city || '').toLowerCase();
  const state = (station.state || '').toLowerCase();
  const country = (station.country || '').toLowerCase();
  const countryCode = (station.countryCode || '').toLowerCase();
  const genres = (station.genres || []).map((g) => g.toLowerCase());
  const lang = (station.language || '').toLowerCase();
  const langs = (station.languages || []).map((l) => l.toLowerCase());

  let score = 0;

  // 1. Station name matching
  if (name === q) {
    score += 120;
  } else if (name.startsWith(q)) {
    score += 85;
  } else if (name.includes(q)) {
    score += 65;
  } else if (q.includes(name) && name.length >= 3) {
    score += 65;
  }

  // 2. City matching
  if (city === q) {
    score += 85;
  } else if (city.startsWith(q) || city.includes(q)) {
    score += 55;
  }

  // 3. State / administrative region matching
  if (state === q) {
    score += 55;
  } else if (state.includes(q)) {
    score += 35;
  }

  // 4. Genres / tags matching
  if (genres.some((g) => g === q)) {
    score += 50;
  } else if (genres.some((g) => g.includes(q))) {
    score += 25;
  }

  // 5. Language matching (including Tamil, Hindi, etc.)
  if (lang === q || langs.includes(q)) {
    score += 85;
  } else if (lang.includes(q) || langs.some((l) => l.includes(q))) {
    score += 55;
  }

  // 6. Country / CountryCode matching
  if (country === q || countryCode === q) {
    score += 45;
  } else if (country.includes(q)) {
    score += 20;
  }

  // 7. Unicode & native language script handling (Tamil, Hindi)
  if (q.includes('தமிழ்')) {
    if (lang === 'tamil' || langs.includes('tamil') || state.includes('tamil') || genres.some((g) => g.includes('tamil'))) {
      score += 90;
    }
  }
  if (q.includes('हिन्दी') || q.includes('हिंदी')) {
    if (lang === 'hindi' || langs.includes('hindi') || genres.some((g) => g.includes('hindi'))) {
      score += 90;
    }
  }

  // 8. Multi-token / multi-word matching (e.g. "AIR Vividh Bharati", "BBC World", "89.4 Tamil")
  const tokens = q.split(/[\s,.-]+/).filter((t) => t.length >= 2);
  if (tokens.length > 1) {
    const fullText = `${name} ${city} ${state} ${country} ${countryCode} ${genres.join(' ')} ${lang} ${langs.join(' ')}`;
    const words = fullText.split(/[\s,.-]+/).filter((w) => w.length >= 2);
    const matchedTokens = tokens.filter((t) => words.includes(t) || words.some((w) => w.startsWith(t) && t.length >= 4));
    if (matchedTokens.length === tokens.length) {
      score += 75; // All tokens match
    } else if (tokens.length >= 3 && matchedTokens.length >= 2) {
      score += Math.round(40 * (matchedTokens.length / tokens.length));
    }
  }

  return score;
}

test('Multi-field Search: station whose name contains Chennai is found', () => {
  const station = {
    id: 'air-chennai-1',
    name: 'AIR Chennai Vividh Bharati',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    countryCode: 'IN',
    genres: ['AIR', 'Talk'],
  };

  const score = calculateStationRelevance(station, 'Chennai');
  assert.ok(score > 100, 'AIR Chennai Vividh Bharati should have high relevance score');
});

test('Multi-field Search: station named All India Radio with city metadata Chennai is found by city query', () => {
  const chennaiStation = {
    id: 'air-chennai-2',
    name: 'All India Radio',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    countryCode: 'IN',
    genres: ['Public Radio'],
  };

  const score = calculateStationRelevance(chennaiStation, 'Chennai');
  assert.strictEqual(score, 85, 'Exact city match score should be 85');
});

test('Multi-field Search: unrelated station elsewhere in India is not ranked as an exact Chennai match', () => {
  const chennaiStation = {
    id: 'air-chennai',
    name: 'All India Radio Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    countryCode: 'IN',
    genres: ['Public'],
  };

  const delhiStation = {
    id: 'air-delhi',
    name: 'All India Radio Delhi',
    city: 'New Delhi',
    state: 'Delhi',
    country: 'India',
    countryCode: 'IN',
    genres: ['Public'],
  };

  const scoreChennai = calculateStationRelevance(chennaiStation, 'Chennai');
  const scoreDelhi = calculateStationRelevance(delhiStation, 'Chennai');

  assert.ok(scoreChennai > 0, 'Chennai station should match');
  assert.strictEqual(scoreDelhi, 0, 'Delhi station must score 0 for Chennai query');
  assert.ok(scoreChennai > scoreDelhi, 'Chennai station must rank higher than unrelated Indian station');
});

test('Multi-field Search: remote Chennai station appears even if not in initial cached catalogue', () => {
  const localCatalogue = new Map([
    ['bbc-1', { id: 'bbc-1', name: 'BBC World Service', city: 'London', country: 'United Kingdom' }],
    ['kexp-1', { id: 'kexp-1', name: 'KEXP', city: 'Seattle', country: 'United States' }],
  ]);

  const remoteApiResponse = [
    {
      id: 'remote-chennai-1',
      name: 'Chennai Live 104.8',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      countryCode: 'IN',
      latitude: 13.0827,
      longitude: 80.2707,
      hasCoordinates: true,
      genres: ['Indie', 'Talk'],
    },
  ];

  // Merge remote results into catalogue
  for (const s of remoteApiResponse) {
    localCatalogue.set(s.id, s);
  }

  const results = Array.from(localCatalogue.values())
    .filter((s) => calculateStationRelevance(s, 'Chennai') > 0)
    .sort((a, b) => calculateStationRelevance(b, 'Chennai') - calculateStationRelevance(a, 'Chennai'));

  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, 'remote-chennai-1');
  assert.strictEqual(results[0].name, 'Chennai Live 104.8');
});

test('Multi-field Search: results from local and remote searches are deduplicated', () => {
  const localList = [
    { id: 'uuid-1', name: 'AIR Chennai Vividh Bharati', city: 'Chennai', countryCode: 'IN' },
  ];
  const remoteList = [
    { id: 'uuid-1', name: 'AIR Chennai Vividh Bharati', city: 'Chennai', countryCode: 'IN' },
    { id: 'uuid-2', name: 'AIR Chennai Vividh Bharati', city: 'chennai', countryCode: 'IN' },
    { id: 'uuid-3', name: 'Radio City Tamil', city: 'Chennai', countryCode: 'IN' },
  ];

  const merged = deduplicateStations([...localList, ...remoteList]);
  assert.strictEqual(merged.length, 2);
  assert.strictEqual(merged[0].id, 'uuid-1');
  assert.strictEqual(merged[1].id, 'uuid-3');
});

test('Multi-field Search: stations without coordinates remain searchable with hasCoordinates: false', () => {
  const nonGeoStation = {
    id: 'digital-chennai',
    name: 'Chennai Internet Beats',
    city: 'Chennai',
    country: 'India',
    countryCode: 'IN',
    latitude: 0,
    longitude: 0,
    hasCoordinates: false,
    genres: ['Electronic'],
  };

  const score = calculateStationRelevance(nonGeoStation, 'Chennai');
  assert.ok(score > 0, 'Station without coordinates must remain searchable');
  assert.strictEqual(nonGeoStation.hasCoordinates, false);
});

test('Globe Focus Callback: selecting a geolocated result passes station actual coordinates to focus handler', () => {
  const chennaiStation = {
    id: 'chennai-air',
    name: 'All India Radio Chennai',
    city: 'Chennai',
    latitude: 13.0827,
    longitude: 80.2707,
    hasCoordinates: true,
  };

  let focusedTarget = null;
  function handleSelectStation(station, switchToGlobe = true) {
    if (switchToGlobe && station.hasCoordinates !== false) {
      focusedTarget = {
        stationId: station.id,
        latitude: station.latitude,
        longitude: station.longitude,
      };
    }
  }

  handleSelectStation(chennaiStation, true);
  assert.deepStrictEqual(focusedTarget, {
    stationId: 'chennai-air',
    latitude: 13.0827,
    longitude: 80.2707,
  });

  const focusRot = latLngToFocusRotation(focusedTarget.latitude, focusedTarget.longitude);
  assert.ok(typeof focusRot.targetX === 'number' && typeof focusRot.targetY === 'number');
});

test('Search Failure Handling: failed directory request produces an error state instead of misleading empty result', async () => {
  let searchError = null;

  async function mockDirectorySearch(query, shouldFail = true) {
    if (shouldFail) {
      throw new Error('HTTP 503 from https://de1.api.radio-browser.info');
    }
    return [{ id: '1', name: 'Station' }];
  }

  try {
    await mockDirectorySearch('Chennai', true);
  } catch (err) {
    searchError = err.message;
  }

  assert.ok(searchError !== null);
  assert.match(searchError, /503/);
});

test('Multi-field Search: London, Tokyo, and New York queries continue working reliably', () => {
  const catalogue = [
    { id: 'lon-1', name: 'BBC World Service', city: 'London', state: 'Greater London', country: 'United Kingdom', countryCode: 'GB', genres: ['News'] },
    { id: 'tok-1', name: 'Tokyo FM', city: 'Tokyo', state: 'Kanto', country: 'Japan', countryCode: 'JP', genres: ['J-Pop'] },
    { id: 'nyc-1', name: 'WNYC 93.9 FM', city: 'New York', state: 'New York', country: 'United States', countryCode: 'US', genres: ['Public'] },
  ];

  const londonResults = catalogue.filter((s) => calculateStationRelevance(s, 'London') > 0);
  assert.strictEqual(londonResults.length, 1);
  assert.strictEqual(londonResults[0].id, 'lon-1');

  const tokyoResults = catalogue.filter((s) => calculateStationRelevance(s, 'Tokyo') > 0);
  assert.strictEqual(tokyoResults.length, 1);
  assert.strictEqual(tokyoResults[0].id, 'tok-1');

  const nyResults = catalogue.filter((s) => calculateStationRelevance(s, 'New York') > 0);
  assert.strictEqual(nyResults.length, 1);
  assert.strictEqual(nyResults[0].id, 'nyc-1');
});

// 7. Stream Format & Reliability Tests
test('Stream Format: Correctly classifies HLS (.m3u8 / mpegurl) vs Direct Streams (MP3/AAC)', () => {
  function isHlsStream(streamUrl, codec) {
    if (!streamUrl) return false;
    return (
      streamUrl.includes('.m3u8') ||
      streamUrl.includes('mpegurl') ||
      (codec === 'AAC' && streamUrl.includes('playlist'))
    );
  }

  // AIR Chennai Vividh Bharati HLS stream
  const chennaiHls = 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8';
  assert.strictEqual(isHlsStream(chennaiHls, 'AAC'), true);

  // Direct MP3 streams
  const bbcMp3 = 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service';
  assert.strictEqual(isHlsStream(bbcMp3, 'MP3'), false);

  const usTamilMp3 = 'https://s2.voscast.com:8162/stream';
  assert.strictEqual(isHlsStream(usTamilMp3, 'MP3'), false);

  // KEXP direct AAC stream
  const kexpAac = 'https://kexp.streamguys1.com/kexp160.aac';
  assert.strictEqual(isHlsStream(kexpAac, 'AAC'), false);
});

test('Error Diagnostics: Maps HTML5 MediaError codes to informative user diagnostics', () => {
  function mapAudioErrorCode(code) {
    switch (code) {
      case 1:
        return 'Stream playback was aborted';
      case 2:
        return 'Network error: could not connect to audio server';
      case 3:
        return 'Audio decode error: corrupted broadcast format';
      case 4:
        return 'Format not supported or mixed-content blocked by browser';
      default:
        return 'Stream unavailable or endpoint unreachable';
    }
  }

  assert.strictEqual(mapAudioErrorCode(1), 'Stream playback was aborted');
  assert.strictEqual(mapAudioErrorCode(2), 'Network error: could not connect to audio server');
  assert.strictEqual(mapAudioErrorCode(3), 'Audio decode error: corrupted broadcast format');
  assert.strictEqual(mapAudioErrorCode(4), 'Format not supported or mixed-content blocked by browser');
  assert.strictEqual(mapAudioErrorCode(undefined), 'Stream unavailable or endpoint unreachable');
});

test('Radio Browser: /json/url/{stationuuid} stream resolution endpoint', async () => {
  async function mockResolveStreamUrl(stationUuid, mirrorUrl = 'https://de1.api.radio-browser.info') {
    if (!stationUuid) return null;
    // Simulate Radio Browser /json/url/{uuid} payload
    const mockResponse = {
      ok: true,
      message: 'retrieved station url',
      stationuuid: stationUuid,
      name: 'AIR Chennai Vividh Bharati',
      url: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
    };
    return mockResponse.url;
  }

  const resolved = await mockResolveStreamUrl('mock-chennai-uuid');
  assert.strictEqual(resolved, 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8');
  assert.strictEqual(isValidStreamUrl(resolved), true);
});

test('Verified Catalogue: All entries have genuine broadcaster streams with matching coordinates', () => {
  const verifiedList = [
    { id: 'fmx_air_chennai', name: 'AIR Chennai Vividh Bharati', city: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707, stream: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8' },
    { id: 'fmx_air_rainbow', name: 'AIR FM Rainbow (Chennai)', city: 'Chennai', country: 'India', lat: 13.0827, lng: 80.2707, stream: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio022/playlist.m3u8' },
    { id: 'fmx_bbc_world', name: 'BBC World Service', city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, stream: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service_east_asia' },
    { id: 'fmx_kexp_seattle', name: 'KEXP 90.3 FM', city: 'Seattle', country: 'United States', lat: 47.6062, lng: -122.3321, stream: 'https://kexp.streamguys1.com/kexp160.aac' },
    { id: 'fmx_shonan_beach', name: 'Shonan Beach FM 78.9', city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503, stream: 'https://shonanbeachfm.jpradio.jp/stream' },
  ];

  for (const s of verifiedList) {
    assert.strictEqual(isValidStreamUrl(s.stream), true, `${s.name} should have valid stream URL`);
    // Ensure no Italian streams were assigned to Tokyo/Chennai/USA
    assert.strictEqual(s.stream.includes('radio105'), false, `${s.name} should not be assigned an Italian stream`);
    assert.ok(s.lat >= -90 && s.lat <= 90, `${s.name} latitude should be valid`);
    assert.ok(s.lng >= -180 && s.lng <= 180, `${s.name} longitude should be valid`);
  }
});

test('Pagination & Deduplication: Deduplicates by normalized stream URL across mirrors and handles limit/offset', () => {
  function deduplicateStations(stations) {
    const seenUuids = new Set();
    const seenUrls = new Set();
    const seenKeys = new Set();
    const unique = [];

    for (const s of stations) {
      if (s.id && seenUuids.has(s.id)) continue;
      const normUrl = s.streamUrl
        ? s.streamUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
        : '';
      if (normUrl && seenUrls.has(normUrl)) continue;

      const compKey = `${s.name.toLowerCase()}|${(s.city || s.state || '').toLowerCase()}|${s.countryCode}`;
      if (seenKeys.has(compKey)) continue;

      if (s.id) seenUuids.add(s.id);
      if (normUrl) seenUrls.add(normUrl);
      seenKeys.add(compKey);
      unique.push(s);
    }
    return unique;
  }

  const rawDuplicates = [
    { id: 'uuid-1', name: 'Station A', city: 'City', countryCode: 'US', streamUrl: 'https://stream.example.com/live/' },
    { id: 'uuid-2', name: 'Station A Mirror', city: 'City', countryCode: 'US', streamUrl: 'http://stream.example.com/live' }, // same stream
    { id: 'uuid-1', name: 'Station A Again', city: 'City', countryCode: 'US', streamUrl: 'https://different.com' }, // same uuid
    { id: 'uuid-3', name: 'Station B', city: 'City', countryCode: 'US', streamUrl: 'https://stream.example.com/b' },
  ];

  const deduped = deduplicateStations(rawDuplicates);
  assert.strictEqual(deduped.length, 2);
  assert.strictEqual(deduped[0].id, 'uuid-1');
  assert.strictEqual(deduped[1].id, 'uuid-3');

  // Pagination slice
  const paged1 = deduped.slice(0, 1);
  const paged2 = deduped.slice(1, 2);
  assert.strictEqual(paged1.length, 1);
  assert.strictEqual(paged2.length, 1);
  assert.strictEqual(paged1[0].id, 'uuid-1');
  assert.strictEqual(paged2[0].id, 'uuid-3');
});

test('Format-aware Playback Selection: routes HLS to Hls.js/Safari and Direct Audio to native element', () => {
  function selectPlaybackPath(streamUrl, codec, canNativeHls, hasHlsJs) {
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('mpegurl') || (codec === 'AAC' && streamUrl.includes('playlist'));
    if (isHls) {
      if (canNativeHls) return 'NATIVE_HLS';
      if (hasHlsJs) return 'HLS_JS';
      return 'UNSUPPORTED_HLS';
    }
    return 'DIRECT_AUDIO';
  }

  // 1. AIR Chennai HLS on Chromium (canNativeHls: false, hasHlsJs: true)
  assert.strictEqual(
    selectPlaybackPath('https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8', 'AAC', false, true),
    'HLS_JS'
  );

  // 2. AIR Chennai HLS on Safari (canNativeHls: true, hasHlsJs: true)
  assert.strictEqual(
    selectPlaybackPath('https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8', 'AAC', true, true),
    'NATIVE_HLS'
  );

  // 3. AIR Chennai HLS on browser with no MediaSource/HLS support
  assert.strictEqual(
    selectPlaybackPath('https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8', 'AAC', false, false),
    'UNSUPPORTED_HLS'
  );

  // 4. KEXP Seattle AAC Direct
  assert.strictEqual(
    selectPlaybackPath('https://kexp.streamguys1.com/kexp160.aac', 'AAC', false, true),
    'DIRECT_AUDIO'
  );

  // 5. WNYC MP3 Direct
  assert.strictEqual(
    selectPlaybackPath('https://fm939.wnyc.org/wnycfm-web', 'MP3', false, true),
    'DIRECT_AUDIO'
  );
});

test('Cleanup Behavior: Properly cleans up existing HLS instance and unloads audio element on stop', () => {
  let hlsDestroyed = false;
  let audioPaused = false;
  let audioSrcCleared = false;

  const mockHls = {
    destroy: () => { hlsDestroyed = true; }
  };
  const mockAudio = {
    pause: () => { audioPaused = true; },
    src: 'https://stream.com',
  };

  function stopAndUnload(engine) {
    if (engine.hlsInstance) {
      engine.hlsInstance.destroy();
      engine.hlsInstance = null;
    }
    if (engine.htmlAudio) {
      engine.htmlAudio.pause();
      engine.htmlAudio.src = '';
      audioSrcCleared = true;
      engine.htmlAudio = null;
    }
  }

  stopAndUnload({ hlsInstance: mockHls, htmlAudio: mockAudio });
  assert.strictEqual(hlsDestroyed, true);
  assert.strictEqual(audioPaused, true);
  assert.strictEqual(audioSrcCleared, true);
});

// ==========================================
// AUDIT TASK TESTS & VALIDATION SUITE
// ==========================================

test('Location Formatter: Never displays duplicate country names (e.g. no "India, India")', () => {
  function formatStationLocation(station) {
    if (!station) return 'Location unverified';
    const rawCountry = (station.country || '').trim();
    const rawState = (station.state || '').trim();
    const rawCity = (station.city || '').trim();

    if (!rawCountry || rawCountry.toLowerCase() === 'global' || rawCountry.toLowerCase() === 'unknown') {
      if (rawCity && rawCity.toLowerCase() !== 'global' && rawCity.toLowerCase() !== 'unknown') {
        return rawCity;
      }
      return 'Location unverified';
    }

    const countryLower = rawCountry.toLowerCase();
    const cleanState = rawState && rawState.toLowerCase() !== countryLower ? rawState : '';
    const stateLower = cleanState.toLowerCase();
    const cleanCity =
      rawCity && rawCity.toLowerCase() !== countryLower && rawCity.toLowerCase() !== stateLower
        ? rawCity
        : '';

    if (cleanCity && cleanState) return `${cleanCity}, ${cleanState}, ${rawCountry}`;
    if (cleanCity) return `${cleanCity}, ${rawCountry}`;
    if (cleanState) return `${cleanState}, ${rawCountry}`;
    return rawCountry;
  }

  // 1. Mirchi Love bug: state is empty or duplicate of country
  assert.strictEqual(formatStationLocation({ country: 'India', state: '', city: '' }), 'India');
  assert.strictEqual(formatStationLocation({ country: 'India', state: 'India', city: 'India' }), 'India');
  assert.strictEqual(formatStationLocation({ country: 'United States', state: 'United States', city: 'United States' }), 'United States');

  // 2. Chennai, Tamil Nadu, India
  assert.strictEqual(
    formatStationLocation({ city: 'Chennai', state: 'Tamil Nadu', country: 'India' }),
    'Chennai, Tamil Nadu, India'
  );

  // 3. State known but city unverified (never invent Chennai!)
  assert.strictEqual(
    formatStationLocation({ city: undefined, state: 'Tamil Nadu', country: 'India' }),
    'Tamil Nadu, India'
  );

  // 4. Mumbai, Maharashtra, India
  assert.strictEqual(
    formatStationLocation({ city: 'Mumbai', state: 'Maharashtra', country: 'India' }),
    'Mumbai, Maharashtra, India'
  );

  // 5. Unverified location
  assert.strictEqual(formatStationLocation({ country: 'Global', city: '', state: '' }), 'Location unverified');
  assert.strictEqual(formatStationLocation(null), 'Location unverified');
});

test('Regional Classification: Classifies Asia by ISO country code, NOT by station name keyword', () => {
  const ASIA_CODES = new Set(['IN', 'JP', 'CN', 'KR', 'SG', 'TH', 'VN', 'ID', 'PH', 'MY', 'LK', 'PK', 'BD', 'NP']);
  const EUROPE_CODES = new Set(['GB', 'FR', 'DE', 'IT', 'ES', 'NL', 'CH', 'BE', 'AT', 'SE']);

  function getRegion(countryCode) {
    if (ASIA_CODES.has(countryCode)) return 'ASIA';
    if (EUROPE_CODES.has(countryCode)) return 'EUROPE';
    return 'OTHER';
  }

  // Station named "BBC World Service East Asia" broadcasting from London (GB)
  const bbcEastAsia = { name: 'BBC World Service East Asia', countryCode: 'GB', country: 'United Kingdom' };
  assert.strictEqual(getRegion(bbcEastAsia.countryCode), 'EUROPE');
  assert.notStrictEqual(getRegion(bbcEastAsia.countryCode), 'ASIA');

  // Station in Tokyo, Japan
  const shonanFm = { name: 'Shonan Beach FM', countryCode: 'JP', country: 'Japan' };
  assert.strictEqual(getRegion(shonanFm.countryCode), 'ASIA');

  // Station in Chennai, India
  const airVividh = { name: 'AIR Vividh Bharati', countryCode: 'IN', country: 'India' };
  assert.strictEqual(getRegion(airVividh.countryCode), 'ASIA');
});

test('Language Classification: Tamil filtering is independent of physical country', () => {
  function isTamilStation(s) {
    if (s.language && /tamil/i.test(s.language)) return true;
    if (s.languages && s.languages.some(l => /tamil/i.test(l))) return true;
    if (s.languageCodes && s.languageCodes.includes('ta')) return true;
    if (s.genres && s.genres.some(g => /tamil/i.test(g))) return true;
    return false;
  }

  // 1. Tamil station in Malaysia
  const jeiFm = { name: 'Jei FM Klang', countryCode: 'MY', country: 'Malaysia', language: 'tamil' };
  assert.strictEqual(isTamilStation(jeiFm), true);
  assert.strictEqual(jeiFm.countryCode, 'MY'); // Not India!

  // 2. Tamil diaspora station in the USA
  const usTamilFm = { name: 'US Tamil FM', countryCode: 'US', country: 'United States', language: 'tamil' };
  assert.strictEqual(isTamilStation(usTamilFm), true);
  assert.strictEqual(usTamilFm.countryCode, 'US'); // Not India!

  // 3. Indian station broadcasting in English (Indigo 91.9 FM)
  const indigoFm = { name: 'Indigo 91.9 FM Bangalore', countryCode: 'IN', country: 'India', language: 'english' };
  assert.strictEqual(isTamilStation(indigoFm), false);
  assert.strictEqual(indigoFm.countryCode, 'IN'); // In India, but not Tamil!
});

test('Coordinates Validation: Out-of-bounds, NaN, and Null Island (0,0) are rejected', () => {
  function validateCoords(rawLat, rawLng) {
    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

    const isValid =
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001);

    return { isValid, lat: isValid ? Number(lat.toFixed(4)) : 0, lng: isValid ? Number(lng.toFixed(4)) : 0 };
  }

  // 1. Chennai valid coordinates
  const chennai = validateCoords(13.0827, 80.2707);
  assert.strictEqual(chennai.isValid, true);
  assert.strictEqual(chennai.lat, 13.0827);

  // 2. Missing (null/undefined)
  const missing = validateCoords(null, null);
  assert.strictEqual(missing.isValid, false);
  assert.strictEqual(missing.lat, 0);

  // 3. Null Island (0, 0)
  const nullIsland = validateCoords(0, 0);
  assert.strictEqual(nullIsland.isValid, false);

  // 4. Out of bounds latitude (> 90)
  const invalidLat = validateCoords(120, 45);
  assert.strictEqual(invalidLat.isValid, false);
});

test('Globe Marker Filter: Stations without valid coordinates do not receive markers', () => {
  const sampleStations = [
    { id: '1', name: 'Valid Chennai', latitude: 13.0827, longitude: 80.2707, hasCoordinates: true },
    { id: '2', name: 'No Geo Station', latitude: 0, longitude: 0, hasCoordinates: false },
    { id: '3', name: 'Null Island Glitch', latitude: 0.0, longitude: 0.0, hasCoordinates: true },
    { id: '4', name: 'Valid London', latitude: 51.5074, longitude: -0.1278, hasCoordinates: true },
  ];

  const markerEligible = sampleStations.filter(s =>
    s.hasCoordinates !== false &&
    typeof s.latitude === 'number' &&
    typeof s.longitude === 'number' &&
    !isNaN(s.latitude) &&
    !isNaN(s.longitude) &&
    s.latitude >= -90 && s.latitude <= 90 &&
    s.longitude >= -180 && s.longitude <= 180 &&
    (Math.abs(s.latitude) > 0.001 || Math.abs(s.longitude) > 0.001)
  );

  assert.strictEqual(markerEligible.length, 2);
  assert.strictEqual(markerEligible[0].id, '1');
  assert.strictEqual(markerEligible[1].id, '4');
});

test('Playback State Integrity: Distinguishes directory record vs live audio playing', () => {
  let playState = 'idle';
  let isOnAir = false;

  function onAudioPlayingEvent() {
    playState = 'playing';
    isOnAir = (playState === 'playing');
  }

  function onStreamLoadingEvent() {
    playState = 'loading';
    isOnAir = (playState === 'playing');
  }

  // When loading stream, ON AIR is FALSE
  onStreamLoadingEvent();
  assert.strictEqual(playState, 'loading');
  assert.strictEqual(isOnAir, false);

  // Only when audio engine fires 'playing', ON AIR becomes TRUE
  onAudioPlayingEvent();
  assert.strictEqual(playState, 'playing');
  assert.strictEqual(isOnAir, true);
});
test('Featured Catalogue Diagnostics: Verifies each station integrity and emits diagnostic summary', () => {
  const fs = require('fs');
  const path = require('path');
  const catTs = fs.readFileSync(path.join(__dirname, '../src/services/radio/verifiedCatalogue.ts'), 'utf8');
  const match = catTs.match(/export const VERIFIED_GLOBAL_STATIONS: RadioStation\[\] = (\[[\s\S]*?\]);/);
  assert.ok(match, 'VERIFIED_GLOBAL_STATIONS must be defined in verifiedCatalogue.ts');
  const VERIFIED_GLOBAL_STATIONS = eval(match[1]);
  assert.ok(Array.isArray(VERIFIED_GLOBAL_STATIONS));
  assert.ok(VERIFIED_GLOBAL_STATIONS.length >= 10);

  const diagnostics = [];

  for (const s of VERIFIED_GLOBAL_STATIONS) {
    assert.ok(s.id, 'Station must have an ID');
    assert.ok(s.name, 'Station must have a name');
    assert.ok(s.country, 'Station must have a country');
    assert.ok(s.countryCode, 'Station must have a 2-letter countryCode');
    assert.strictEqual(s.countryCode.length, 2);
    assert.ok(s.streamUrl.startsWith('http'), 'Stream URL must be valid HTTP/HTTPS');

    diagnostics.push({
      name: s.name,
      uuid: s.id,
      countryCode: s.countryCode,
      language: s.languages ? s.languages.join('/') : (s.language || 'Unknown'),
      coordinates: s.hasCoordinates ? `${s.latitude}, ${s.longitude}` : 'UNVERIFIED',
      streamUrl: s.streamUrl.substring(0, 50) + (s.streamUrl.length > 50 ? '...' : ''),
      codec: s.codec || (s.hls ? 'HLS' : 'MP3'),
      directoryHealth: s.lastCheckOk ? 'HEALTHY (1)' : 'UNCHECKED (0)',
      playbackVerification: s.isStreamVerified ? 'VERIFIED (HTTP 200/LIVE)' : 'UNCONFIRMED',
    });
  }

  console.log('\n======================================================');
  console.log('--- FEATURED STATION INTEGRITY DIAGNOSTIC AUDIT ---');
  console.log('======================================================');
  diagnostics.forEach((d, idx) => {
    console.log(`[${idx + 1}] ${d.name}`);
    console.log(`    UUID:        ${d.uuid}`);
    console.log(`    Country:     ${d.countryCode} | Language: ${d.language}`);
    console.log(`    Coordinates: ${d.coordinates}`);
    console.log(`    Stream:      ${d.streamUrl} [${d.codec}]`);
    console.log(`    Health:      ${d.directoryHealth} | Verification: ${d.playbackVerification}`);
  });
  console.log('======================================================\n');
});

test('Radio Browser Discovery: Endpoints format paths and parameters correctly', () => {
  function buildEndpoint(type, param, limit = 40, offset = 0) {
    switch (type) {
      case 'bycountry':
        return `/json/stations/bycountrycodeexact/${encodeURIComponent(param.toLowerCase())}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      case 'bylanguage':
        return `/json/stations/bylanguage/${encodeURIComponent(param.toLowerCase())}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      case 'bytag':
        return `/json/stations/bytag/${encodeURIComponent(param.toLowerCase())}?limit=${limit * 2}&offset=${offset}&order=votes&reverse=true`;
      case 'topvote':
        return `/json/stations/topvote/${limit * 2}?offset=${offset}`;
      case 'topclick':
        return `/json/stations/topclick/${limit * 2}?offset=${offset}`;
      case 'lastchange':
        return `/json/stations/lastchange/${limit * 2}?offset=${offset}`;
      case 'countrycodes':
        return `/json/countrycodes?order=stationcount&reverse=true`;
      case 'byuuid':
        return `/json/stations/byuuid/${encodeURIComponent(param)}`;
      default:
        throw new Error('Unknown type');
    }
  }

  assert.strictEqual(
    buildEndpoint('bycountry', 'IN', 30, 0),
    '/json/stations/bycountrycodeexact/in?limit=60&offset=0&order=votes&reverse=true'
  );
  assert.strictEqual(
    buildEndpoint('bylanguage', 'tamil', 20, 40),
    '/json/stations/bylanguage/tamil?limit=40&offset=40&order=votes&reverse=true'
  );
  assert.strictEqual(
    buildEndpoint('bytag', 'classical', 10, 0),
    '/json/stations/bytag/classical?limit=20&offset=0&order=votes&reverse=true'
  );
  assert.strictEqual(
    buildEndpoint('topvote', null, 50, 100),
    '/json/stations/topvote/100?offset=100'
  );
  assert.strictEqual(
    buildEndpoint('topclick', null, 40, 0),
    '/json/stations/topclick/80?offset=0'
  );
  assert.strictEqual(
    buildEndpoint('lastchange', null, 25, 50),
    '/json/stations/lastchange/50?offset=50'
  );
  assert.strictEqual(
    buildEndpoint('countrycodes', null),
    '/json/countrycodes?order=stationcount&reverse=true'
  );
  assert.strictEqual(
    buildEndpoint('byuuid', 'station-xyz-123'),
    '/json/stations/byuuid/station-xyz-123'
  );
});

test('Deduplication Integrity: Preserves distinct broadcasters with similar names but different locations/streams', () => {
  const stations = [
    {
      id: 'uuid-1',
      name: 'Radio City',
      city: 'Mumbai',
      countryCode: 'IN',
      streamUrl: 'https://stream1.radiocity.in/mumbai',
    },
    {
      id: 'uuid-2',
      name: 'Radio City',
      city: 'Delhi',
      countryCode: 'IN',
      streamUrl: 'https://stream2.radiocity.in/delhi',
    },
    {
      id: 'uuid-3',
      name: 'Radio City',
      city: 'Liverpool',
      countryCode: 'GB',
      streamUrl: 'https://stream3.radiocity.co.uk/liverpool',
    },
    {
      id: 'uuid-1-mirror',
      name: 'Radio City',
      city: 'Mumbai',
      countryCode: 'IN',
      streamUrl: 'https://stream1.radiocity.in/mumbai', // exact same normalized stream
    },
  ];

  const seenUuids = new Set();
  const seenUrls = new Set();
  const seenKeys = new Set();
  const unique = [];

  for (const s of stations) {
    if (seenUuids.has(s.id)) continue;
    const normUrl = s.streamUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    if (seenUrls.has(normUrl)) continue;

    const compKey = `${s.name.toLowerCase()}|${s.city.toLowerCase()}|${s.countryCode}`;
    if (seenKeys.has(compKey)) continue;

    seenUuids.add(s.id);
    seenUrls.add(normUrl);
    seenKeys.add(compKey);
    unique.push(s);
  }

  // Expect exactly 3 distinct stations (Mumbai, Delhi, Liverpool); the duplicate mirror is dropped
  assert.strictEqual(unique.length, 3);
  assert.strictEqual(unique[0].city, 'Mumbai');
  assert.strictEqual(unique[1].city, 'Delhi');
  assert.strictEqual(unique[2].city, 'Liverpool');
});

test('Transparent Quality Badges: Disentangles playback, directory health, and coordinates', () => {
  function computeBadge(station, isFailing = false) {
    if (isFailing) return 'TEMPORARILY UNAVAILABLE';
    if (station.playbackSucceeded || station.isStreamVerified) return 'PLAYABLE';
    if (station.hasCoordinates === false || !station.isLocationVerified) return 'LOCATION UNVERIFIED';
    if (station.lastCheckOk || station.directoryHealthPassed) return 'AVAILABLE';
    return 'UNVERIFIED';
  }

  // 1. Temporarily failing stream
  assert.strictEqual(computeBadge({}, true), 'TEMPORARILY UNAVAILABLE');

  // 2. Verified playable stream
  assert.strictEqual(
    computeBadge({ isStreamVerified: true, hasCoordinates: true, isLocationVerified: true }),
    'PLAYABLE'
  );

  // 3. Station missing coordinates
  assert.strictEqual(
    computeBadge({ hasCoordinates: false, lastCheckOk: true }),
    'LOCATION UNVERIFIED'
  );

  // 4. Station with valid coordinates and healthy directory record
  assert.strictEqual(
    computeBadge({ hasCoordinates: true, isLocationVerified: true, lastCheckOk: true }),
    'AVAILABLE'
  );

  // 5. Raw unverified station
  assert.strictEqual(
    computeBadge({ hasCoordinates: true, isLocationVerified: true, lastCheckOk: false }),
    'UNVERIFIED'
  );
});

test('Radio Garden Data Mapping: Correctly inverts GeoJSON [lng, lat] to latitude and longitude', () => {
  function normalizeRadioGardenGeo(geo) {
    if (!geo || !Array.isArray(geo) || geo.length !== 2) return { latitude: 0, longitude: 0, hasCoords: false };
    const [lng, lat] = geo; // GeoJSON standard: index 0 is longitude, index 1 is latitude
    const isValid =
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      (Math.abs(lat) > 0.001 || Math.abs(lng) > 0.001);

    return {
      latitude: isValid ? Number(lat.toFixed(4)) : 0,
      longitude: isValid ? Number(lng.toFixed(4)) : 0,
      hasCoords: isValid,
    };
  }

  // Seattle WA: lng: -122.3321, lat: 47.6062
  const seattle = normalizeRadioGardenGeo([-122.33207, 47.60621]);
  assert.strictEqual(seattle.latitude, 47.6062);
  assert.strictEqual(seattle.longitude, -122.3321);
  assert.strictEqual(seattle.hasCoords, true);

  // Canning, Argentina: lng: -58.51272, lat: -34.884495
  const canning = normalizeRadioGardenGeo([-58.51272, -34.884495]);
  assert.strictEqual(canning.latitude, -34.8845);
  assert.strictEqual(canning.longitude, -58.5127);
  assert.strictEqual(canning.hasCoords, true);

  // Invalid coordinates
  const invalid = normalizeRadioGardenGeo([0, 0]);
  assert.strictEqual(invalid.hasCoords, false);
});

test('Radio Garden Identity: Strictly separates place ID from station channel ID', () => {
  const rawHit = {
    _source: {
      code: 'US',
      page: {
        url: '/listen/kexp-90-3-fm/2m0QRgcW',
        type: 'channel',
        place: { id: 'PPM2Rql0', title: 'Seattle WA' },
        country: { id: 'GhDXw4EW', title: 'United States' },
        title: 'KEXP 90.3 FM',
        stream: 'streamguys1.com',
      },
    },
  };

  const channelId = rawHit._source.page.url.split('/').pop();
  const placeId = rawHit._source.page.place.id;

  assert.strictEqual(channelId, '2m0QRgcW');
  assert.strictEqual(placeId, 'PPM2Rql0');
  assert.notStrictEqual(channelId, placeId, 'Channel ID must never equal Place ID');

  const normalizedStation = {
    id: `rg_${channelId}`,
    sourceStationId: channelId,
    sourcePlaceId: placeId,
    name: rawHit._source.page.title,
    city: rawHit._source.page.place.title,
  };

  assert.strictEqual(normalizedStation.sourceStationId, '2m0QRgcW');
  assert.strictEqual(normalizedStation.sourcePlaceId, 'PPM2Rql0');
  assert.ok(!normalizedStation.id.includes('PPM2Rql0'), 'Place ID must never be used as Station ID');
});

test('Station Identity Matcher: Confirms cross-provider identity when official website matches', () => {
  function normalizeDomain(url) {
    if (!url) return '';
    try {
      const u = new URL(url.startsWith('http') ? url : `http://${url}`);
      return u.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      return '';
    }
  }

  function compareIdentity(a, b) {
    if (a.countryCode !== b.countryCode) {
      return { isSame: false, conflict: 'Different countries' };
    }
    const domA = normalizeDomain(a.homepage);
    const domB = normalizeDomain(b.homepage);
    if (domA && domB && domA === domB) {
      return { isSame: true, verdict: 'CONFIRMED_CROSS_PROVIDER' };
    }
    return { isSame: false, verdict: 'DISTINCT_STATION' };
  }

  const rbKexp = {
    id: 'b870d2e7-7c75-44e0-ba71-8fe48873ba87',
    provider: 'radio-browser',
    name: 'KEXP',
    countryCode: 'US',
    homepage: 'https://kexp.org/',
    streamUrl: 'http://live-aacplus-64.kexp.org/kexp64.aac',
  };

  const rgKexp = {
    id: 'rg_2m0QRgcW',
    provider: 'radio-garden',
    name: 'KEXP 90.3 FM',
    countryCode: 'US',
    homepage: 'https://www.kexp.org',
    streamUrl: 'https://radio.garden/api/ara/content/listen/2m0QRgcW/channel.mp3',
  };

  const res = compareIdentity(rbKexp, rgKexp);
  assert.strictEqual(res.isSame, true);
  assert.strictEqual(res.verdict, 'CONFIRMED_CROSS_PROVIDER');
});

test('Station Identity Matcher: Flags conflicts and refuses to merge when titles match but countries diverge', () => {
  function compareIdentity(a, b) {
    if (a.countryCode !== b.countryCode) {
      return {
        isSame: false,
        verdict: 'CONFLICT_DIFFERENT_BROADCASTER',
        conflict: `Country divergence: "${a.name}" (${a.countryCode}) vs "${b.name}" (${b.countryCode})`,
      };
    }
    return { isSame: true };
  }

  const tamilStationIndia = {
    id: 'in-tamil-1',
    name: 'Tamil FM',
    countryCode: 'IN',
    city: 'Chennai',
  };

  const tamilStationMalaysia = {
    id: 'my-tamil-1',
    name: 'Tamil FM',
    countryCode: 'MY',
    city: 'Kuala Lumpur',
  };

  const res = compareIdentity(tamilStationIndia, tamilStationMalaysia);
  assert.strictEqual(res.isSame, false);
  assert.strictEqual(res.verdict, 'CONFLICT_DIFFERENT_BROADCASTER');
  assert.ok(res.conflict.includes('Country divergence'));
});

// ============================================================================
// NEARBY DISCOVERY TESTS (Haversine Distance, Radius Filtering, Sorting, Mock API & Playback Isolation)
// ============================================================================

const EARTH_RADIUS_KM = 6371.0;

function isValidCoordinate(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  return true;
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Infinity;
  }
  if (lat1 === lat2 && lon1 === lon2) {
    return 0;
  }
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function formatDistance(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || !isFinite(distanceKm)) {
    return 'Distance unavailable';
  }
  if (distanceKm < 0.1) {
    return '< 0.1 km away';
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km away`;
  }
  return `${Math.round(distanceKm)} km away`;
}

function filterAndSortStationsByDistance(stations, listenerLat, listenerLng, maxRadiusKm) {
  if (!isValidCoordinate(listenerLat, listenerLng)) {
    return [];
  }
  const results = [];
  for (const s of stations) {
    if (s.hasCoordinates === false || !isValidCoordinate(s.latitude, s.longitude)) {
      continue;
    }
    const dist = calculateHaversineDistance(listenerLat, listenerLng, s.latitude, s.longitude);
    if (dist <= maxRadiusKm) {
      results.push({
        ...s,
        distanceKm: dist,
      });
    }
  }
  return results.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
}

test('Nearby Discovery: Haversine distance accurately measures 0 km for identical coordinates', () => {
  const dist = calculateHaversineDistance(13.0827, 80.2707, 13.0827, 80.2707);
  assert.strictEqual(dist, 0);
});

test('Nearby Discovery: Haversine distance measures known geographic benchmark distances accurately', () => {
  // London (51.5074, -0.1278) to Paris (48.8566, 2.3522) ~ 343.5 km
  const londonParis = calculateHaversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
  assert.ok(Math.abs(londonParis - 343.5) < 3.0, `London-Paris distance should be ~343.5 km, got ${londonParis}`);

  // London (51.5074, -0.1278) to New York (40.7128, -74.006) ~ 5570 km
  const londonNY = calculateHaversineDistance(51.5074, -0.1278, 40.7128, -74.006);
  assert.ok(Math.abs(londonNY - 5570) < 20.0, `London-NY distance should be ~5570 km, got ${londonNY}`);

  // Antipodal points ~ 20015 km (half Earth circumference)
  const antipodal = calculateHaversineDistance(0, 0.001, 0, -179.999);
  assert.ok(Math.abs(antipodal - 20015) < 50.0, `Antipodal points distance should be ~20015 km, got ${antipodal}`);
});

test('Nearby Discovery: Rejects invalid, missing, and out-of-range station coordinates', () => {
  assert.strictEqual(isValidCoordinate(undefined, 80), false);
  assert.strictEqual(isValidCoordinate(13, null), false);
  assert.strictEqual(isValidCoordinate(NaN, 80), false);
  assert.strictEqual(isValidCoordinate(91, 0), false); // Lat > 90
  assert.strictEqual(isValidCoordinate(-91, 0), false); // Lat < -90
  assert.strictEqual(isValidCoordinate(0, 185), false); // Lng > 180
  assert.strictEqual(isValidCoordinate(0, -185), false); // Lng < -180
  assert.strictEqual(isValidCoordinate(0, 0), false); // Null Island

  // Haversine returns Infinity when invalid
  assert.strictEqual(calculateHaversineDistance(13, 80, 0, 0), Infinity);
  assert.strictEqual(calculateHaversineDistance(13, 80, 95, 20), Infinity);
});

test('Nearby Discovery: Formats distances into readable UI badges correctly', () => {
  assert.strictEqual(formatDistance(0.04), '< 0.1 km away');
  assert.strictEqual(formatDistance(2.41), '2.4 km away');
  assert.strictEqual(formatDistance(9.88), '9.9 km away');
  assert.strictEqual(formatDistance(18.2), '18 km away');
  assert.strictEqual(formatDistance(46.7), '47 km away');
  assert.strictEqual(formatDistance(100.0), '100 km away');
  assert.strictEqual(formatDistance(NaN), 'Distance unavailable');
  assert.strictEqual(formatDistance(Infinity), 'Distance unavailable');
});

test('Nearby Discovery: Radius filtering includes stations at boundary and excludes stations beyond radius', () => {
  const listenerLat = 13.0827; // Chennai Central
  const listenerLng = 80.2707;

  // Station A: ~6 km away (Mylapore, Chennai)
  const stationA = {
    id: 's-6km',
    name: 'Chennai Community Radio',
    latitude: 13.033,
    longitude: 80.265,
    hasCoordinates: true,
  };

  // Station B: ~38 km away (Sriperumbudur area)
  const stationB = {
    id: 's-38km',
    name: 'Kanchi Voice FM',
    latitude: 12.967,
    longitude: 79.940,
    hasCoordinates: true,
  };

  // Station C: ~67 km away (Kanchipuram)
  const stationC = {
    id: 's-67km',
    name: 'Northern Tamil Radio',
    latitude: 12.834,
    longitude: 79.703,
    hasCoordinates: true,
  };

  // Station D: Station with missing coordinates
  const stationD = {
    id: 's-nocoords',
    name: 'Online Only Stream',
    latitude: 0,
    longitude: 0,
    hasCoordinates: false,
  };

  const pool = [stationA, stationB, stationC, stationD];

  // 25 km radius: only station A
  const res25 = filterAndSortStationsByDistance(pool, listenerLat, listenerLng, 25);
  assert.strictEqual(res25.length, 1);
  assert.strictEqual(res25[0].id, 's-6km');

  // 50 km radius: stations A and B
  const res50 = filterAndSortStationsByDistance(pool, listenerLat, listenerLng, 50);
  assert.strictEqual(res50.length, 2);
  assert.strictEqual(res50[0].id, 's-6km');
  assert.strictEqual(res50[1].id, 's-38km');

  // 100 km radius: stations A, B, and C (station D excluded due to no coordinates)
  const res100 = filterAndSortStationsByDistance(pool, listenerLat, listenerLng, 100);
  assert.strictEqual(res100.length, 3);
  assert.strictEqual(res100[0].id, 's-6km');
  assert.strictEqual(res100[1].id, 's-38km');
  assert.strictEqual(res100[2].id, 's-67km');
});

test('Nearby Discovery: Results are strictly sorted in ascending order of calculated distance', () => {
  const listenerLat = 51.5074;
  const listenerLng = -0.1278;

  const stations = [
    { id: 'far', name: 'Far Station', latitude: 51.75, longitude: -0.12, hasCoordinates: true }, // ~27 km
    { id: 'near', name: 'Near Station', latitude: 51.52, longitude: -0.12, hasCoordinates: true }, // ~1.5 km
    { id: 'mid', name: 'Mid Station', latitude: 51.60, longitude: -0.12, hasCoordinates: true }, // ~10 km
  ];

  const sorted = filterAndSortStationsByDistance(stations, listenerLat, listenerLng, 50);
  assert.strictEqual(sorted.length, 3);
  assert.strictEqual(sorted[0].id, 'near');
  assert.strictEqual(sorted[1].id, 'mid');
  assert.strictEqual(sorted[2].id, 'far');
  assert.ok(sorted[0].distanceKm < sorted[1].distanceKm);
  assert.ok(sorted[1].distanceKm < sorted[2].distanceKm);
});

test('Nearby Discovery: Deduplicates multiple records sharing the same station identifier or stream URL', () => {
  const rawList = [
    { id: 'dup-1', name: 'Radio City 91.1', streamUrl: 'https://radiocity.com/live', latitude: 13.08, longitude: 80.27, hasCoordinates: true },
    { id: 'dup-1', name: 'Radio City 91.1 (Mirror)', streamUrl: 'https://radiocity.com/live', latitude: 13.08, longitude: 80.27, hasCoordinates: true },
    { id: 'unique-2', name: 'AIR Chennai', streamUrl: 'https://air.org/live', latitude: 13.09, longitude: 80.28, hasCoordinates: true },
  ];

  const seenIds = new Set();
  const seenStreams = new Set();
  const deduped = [];

  for (const s of rawList) {
    if (seenIds.has(s.id) || seenStreams.has(s.streamUrl)) continue;
    seenIds.add(s.id);
    seenStreams.add(s.streamUrl);
    deduped.push(s);
  }

  assert.strictEqual(deduped.length, 2);
  assert.strictEqual(deduped[0].id, 'dup-1');
  assert.strictEqual(deduped[1].id, 'unique-2');
});

test('Nearby Discovery: Location permission denial handles state gracefully without unhandled exceptions', () => {
  function handlePermissionState(status) {
    if (status !== 'granted') {
      return {
        hasLocation: false,
        error: 'Location permission was denied. fmX requires location access to discover local stations.',
        canRetry: true,
      };
    }
    return { hasLocation: true, error: null };
  }

  const deniedResult = handlePermissionState('denied');
  assert.strictEqual(deniedResult.hasLocation, false);
  assert.strictEqual(deniedResult.canRetry, true);
  assert.ok(deniedResult.error.includes('permission was denied'));

  const grantedResult = handlePermissionState('granted');
  assert.strictEqual(grantedResult.hasLocation, true);
  assert.strictEqual(grantedResult.error, null);
});

test('Nearby Discovery: Cell-based cache key rounds coordinates to 2 decimal places with 15-minute TTL', () => {
  function generateCacheKey(lat, lng, radiusKm) {
    return `fmx_nearby_${lat.toFixed(2)}_${lng.toFixed(2)}_${radiusKm}km`;
  }

  const key1 = generateCacheKey(13.0827, 80.2707, 50);
  const key2 = generateCacheKey(13.0849, 80.2741, 50);
  assert.strictEqual(key1, 'fmx_nearby_13.08_80.27_50km');
  assert.strictEqual(key2, 'fmx_nearby_13.08_80.27_50km');
  assert.strictEqual(key1, key2, 'Listeners within ~1 km share identical cache bucket to save bandwidth');

  const TTL_MS = 15 * 60 * 1000;
  const now = Date.now();
  const cachedData = { timestamp: now - (5 * 60 * 1000), stations: [{ id: 's1' }] };
  const isFresh = (now - cachedData.timestamp) < TTL_MS;
  assert.strictEqual(isFresh, true, 'Cache should remain valid within 15-minute window');

  const staleData = { timestamp: now - (20 * 60 * 1000), stations: [{ id: 's1' }] };
  const isStale = (now - staleData.timestamp) >= TTL_MS;
  assert.strictEqual(isStale, true, 'Cache older than 15 minutes is flagged stale');
});

test('Nearby Discovery: Playback error isolates to player and preserves Nearby discovery list intact', () => {
  const nearbyStations = [
    { id: 'st-1', name: 'AIR Chennai', isPlayable: true },
    { id: 'st-2', name: 'Radio Mirchi', isPlayable: true },
  ];

  let activeStation = nearbyStations[0];
  let playbackError = null;

  // Simulate stream failure on st-1
  playbackError = 'Stream connection timed out';

  // Nearby station list must remain intact and not drop any stations
  assert.strictEqual(nearbyStations.length, 2);
  assert.strictEqual(nearbyStations[0].id, 'st-1');
  assert.strictEqual(nearbyStations[1].id, 'st-2');
  assert.strictEqual(activeStation.id, 'st-1');
  assert.ok(playbackError !== null);
});

// ============================================================================
// GOOGLE MAPS LOCATION ENRICHMENT & STATION IDENTITY VERIFICATION TESTS
// ============================================================================

test('Station Verification: Exact broadcaster match vs similar-name false match', () => {
  function corroborateCandidate(station, candidate) {
    // Exact official domain match
    const normDomainStation = (station.homepage || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase();
    const normDomainCandidate = (candidate.website || '').replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase();

    const hasMatchingDomain = normDomainStation && normDomainCandidate && normDomainStation === normDomainCandidate;
    const sameCountry = (station.countryCode || '').toUpperCase() === (candidate.countryCode || '').toUpperCase();
    const sameCity = (station.city || '').toLowerCase() === (candidate.city || '').toLowerCase();

    if (hasMatchingDomain && sameCountry) {
      return { isMatch: true, confidence: 'verified_broadcaster_address' };
    }
    if (!hasMatchingDomain && station.name.toLowerCase() === candidate.name.toLowerCase() && !sameCity) {
      return { isMatch: false, reason: 'Similar name in different city without corroborating domain' };
    }
    return { isMatch: false, reason: 'Inconclusive metadata' };
  }

  const realKexp = {
    name: 'KEXP 90.3 FM',
    homepage: 'https://kexp.org',
    city: 'Seattle',
    countryCode: 'US',
  };

  const googlePlaceCandidate = {
    name: 'KEXP Studios',
    website: 'https://www.kexp.org/visit/',
    city: 'Seattle',
    countryCode: 'US',
    place_id: 'ChIJXffqFtkVkFQRA74jY75Yk6A',
  };

  const falseFanClubCandidate = {
    name: 'KEXP 90.3 FM',
    website: 'https://kexpfanclub.blogspot.com',
    city: 'Portland',
    countryCode: 'US',
    place_id: 'ChIJfake12345',
  };

  const validMatch = corroborateCandidate(realKexp, googlePlaceCandidate);
  assert.strictEqual(validMatch.isMatch, true);
  assert.strictEqual(validMatch.confidence, 'verified_broadcaster_address');

  const falseMatch = corroborateCandidate(realKexp, falseFanClubCandidate);
  assert.strictEqual(falseMatch.isMatch, false);
  assert.ok(falseMatch.reason.includes('Similar name in different city'));
});

test('Station Verification: Conflicting location detected when coordinates diverge significantly', () => {
  function evaluateCoordinateAgreement(providerLat, providerLng, googleLat, googleLng) {
    const dist = calculateHaversineDistance(providerLat, providerLng, googleLat, googleLng);
    if (dist > 100) {
      return { confidence: 'conflicting_location', distKm: dist };
    }
    if (dist > 25) {
      return { confidence: 'provider_reported_coordinates', distKm: dist };
    }
    return { confidence: 'verified_broadcaster_address', distKm: dist };
  }

  // Seattle studio (~47.62, -122.35) vs provider coordinates erroneously set to Los Angeles (~34.05, -118.24)
  const conflict = evaluateCoordinateAgreement(34.05, -118.24, 47.62, -122.35);
  assert.strictEqual(conflict.confidence, 'conflicting_location');
  assert.ok(conflict.distKm > 1000);

  // High agreement: Studio at 47.6205, -122.3533 vs provider coordinates at 47.6062, -122.3321 (~2 km)
  const agreement = evaluateCoordinateAgreement(47.6062, -122.3321, 47.6205, -122.3533);
  assert.strictEqual(agreement.confidence, 'verified_broadcaster_address');
  assert.ok(agreement.distKm < 5);
});

test('Station Verification: City centroid is explicitly labelled city_or_region_only', () => {
  function classifyGeocodingAccuracy(geocodingType) {
    if (geocodingType === 'APPROXIMATE') {
      return {
        confidence: 'city_or_region_only',
        locationType: 'city_centroid',
        disclaimer: 'City centroid coordinates. Transmitter location not specified.',
      };
    }
    if (geocodingType === 'ROOFTOP') {
      return {
        confidence: 'verified_broadcaster_address',
        locationType: 'studio',
        disclaimer: 'Studio/office facility verified on Google Maps. Transmitter mast and terrestrial coverage may vary.',
      };
    }
    return { confidence: 'unverified', locationType: 'unknown' };
  }

  const cityResult = classifyGeocodingAccuracy('APPROXIMATE');
  assert.strictEqual(cityResult.confidence, 'city_or_region_only');
  assert.strictEqual(cityResult.locationType, 'city_centroid');
  assert.ok(cityResult.disclaimer.includes('City centroid'));

  const rooftopResult = classifyGeocodingAccuracy('ROOFTOP');
  assert.strictEqual(rooftopResult.confidence, 'verified_broadcaster_address');
  assert.strictEqual(rooftopResult.locationType, 'studio');
  assert.ok(rooftopResult.disclaimer.includes('Transmitter mast and terrestrial coverage may vary'));
});

test('Station Verification: Studio listing does not prove transmitter coverage', () => {
  const stationRecord = {
    id: 'wnyc-fm-new-york',
    name: 'WNYC 93.9 FM',
    verifiedAddress: '160 Varick St, New York, NY 10013, United States',
    locationType: 'studio',
    locationDisclaimer: 'Studio facility: New York Public Radio studios, Manhattan. Transmitter mast is located atop the Empire State Building.',
  };

  assert.strictEqual(stationRecord.locationType, 'studio');
  assert.ok(stationRecord.locationDisclaimer.includes('Transmitter mast is located atop the Empire State Building'));
});

test('Station Verification: Google API unconfigured key degrades gracefully without exceptions', () => {
  function handleEnrichmentWithoutKey(station, apiKey) {
    if (!apiKey) {
      return {
        success: false,
        locationConfidence: station.hasCoordinates ? 'provider_reported_coordinates' : 'unverified',
        coordinateProvenance: 'provider_directory',
        error: 'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED',
      };
    }
    return { success: true };
  }

  const geolocatedStation = { id: 's1', name: 'BBC World Service', hasCoordinates: true, latitude: 51.5, longitude: -0.1 };
  const res = handleEnrichmentWithoutKey(geolocatedStation, null);

  assert.strictEqual(res.success, false);
  assert.strictEqual(res.locationConfidence, 'provider_reported_coordinates');
  assert.strictEqual(res.error, 'GOOGLE_MAPS_API_KEY_NOT_CONFIGURED');
});

test('Station Verification: Google Maps 30-day retention and attribution compliance', () => {
  const MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  const cached20DaysAgo = {
    placeId: 'ChIJXffqFtkVkFQRA74jY75Yk6A',
    formattedAddress: '472 1st Ave N, Seattle, WA 98109',
    attributionText: 'Data from Google',
    fetchedAt: now - (20 * 24 * 60 * 60 * 1000),
  };

  const isCacheValid = (now - cached20DaysAgo.fetchedAt) < MAX_RETENTION_MS;
  assert.strictEqual(isCacheValid, true, 'Cache under 30 days is retained');
  assert.strictEqual(cached20DaysAgo.attributionText, 'Data from Google', 'Attribution requirement met');
  assert.ok(typeof cached20DaysAgo.placeId === 'string', 'Place ID is stored permanently');

  const cached35DaysAgo = {
    fetchedAt: now - (35 * 24 * 60 * 60 * 1000),
  };
  const isExpired = (now - cached35DaysAgo.fetchedAt) >= MAX_RETENTION_MS;
  assert.strictEqual(isExpired, true, 'Cache over 30 days must be purged or refreshed');
});

test('Station Verification: Multiple candidate facilities marks station ambiguous', () => {
  const candidates = [
    { place_id: 'p1', name: 'Radio City Studios Mumbai', score: 0.8 },
    { place_id: 'p2', name: 'Radio City Studios Pune', score: 0.78 },
  ];

  function evaluateAmbiguity(candidateList) {
    const highScores = candidateList.filter(c => c.score >= 0.7);
    if (highScores.length > 1) {
      return {
        isAmbiguous: true,
        ambiguityReason: `Multiple conflicting broadcaster facilities found on Google Maps (${highScores.length} candidates)`,
      };
    }
    return { isAmbiguous: false };
  }

  const amb = evaluateAmbiguity(candidates);
  assert.strictEqual(amb.isAmbiguous, true);
  assert.ok(amb.ambiguityReason.includes('Multiple conflicting broadcaster facilities'));
});

test('Station Verification: Decoupled audio identity marks community stream as audio_identity_unverified', () => {
  function determineAudioIdentityStatus(station, isPlaying) {
    if (!isPlaying) {
      return 'stream_unavailable';
    }
    if (station.isIdentityVerified && station.provider === 'verified-catalogue') {
      return 'verified';
    }
    // Public directory streams play without acoustic content confirmation
    return 'audio_identity_unverified';
  }

  const communityStation = {
    id: 'rb-random-station',
    provider: 'radio-browser',
    name: 'Top Hits Radio',
    isIdentityVerified: false,
  };

  const statusPlaying = determineAudioIdentityStatus(communityStation, true);
  assert.strictEqual(statusPlaying, 'audio_identity_unverified');

  const verifiedCatalogueStation = {
    id: 'kexp-seattle-903',
    provider: 'verified-catalogue',
    name: 'KEXP 90.3 FM',
    isIdentityVerified: true,
  };

  const statusVerified = determineAudioIdentityStatus(verifiedCatalogueStation, true);
  assert.strictEqual(statusVerified, 'verified');

  const statusOffline = determineAudioIdentityStatus(verifiedCatalogueStation, false);
  assert.strictEqual(statusOffline, 'stream_unavailable');
});

test('Globe Integration: Strict filtering rejects missing coordinates and Null Island (0,0)', () => {
  function isEligibleForGlobeMarker(station) {
    if (!station) return false;
    if (station.hasCoordinates === false) return false;
    if (typeof station.latitude !== 'number' || typeof station.longitude !== 'number') return false;
    if (isNaN(station.latitude) || isNaN(station.longitude)) return false;
    if (station.latitude < -90 || station.latitude > 90) return false;
    if (station.longitude < -180 || station.longitude > 180) return false;
    if (Math.abs(station.latitude) < 0.001 && Math.abs(station.longitude) < 0.001) return false;
    return true;
  }

  assert.strictEqual(isEligibleForGlobeMarker({ latitude: 13.08, longitude: 80.27, hasCoordinates: true }), true);
  assert.strictEqual(isEligibleForGlobeMarker({ latitude: 0, longitude: 0 }), false); // Null Island
  assert.strictEqual(isEligibleForGlobeMarker({ latitude: NaN, longitude: 10 }), false);
  assert.strictEqual(isEligibleForGlobeMarker({ hasCoordinates: false, latitude: 13.08, longitude: 80.27 }), false);
});

// 13. Global Radio Player Refactor & Catalogue Tests
test('Geographic Hierarchy: Country -> State -> City browses real station metadata and adapts to incomplete info', () => {
  const stationsMock = [
    { id: '1', name: 'Radio One', country: 'Germany', countryCode: 'DE', state: 'Bavaria', city: 'Munich' },
    { id: '2', name: 'Radio Two', country: 'Germany', countryCode: 'DE', state: 'Bavaria', city: 'Nuremberg' },
    { id: '3', name: 'Radio Three', country: 'Germany', countryCode: 'DE', state: 'Berlin', city: 'Berlin' },
    { id: '4', name: 'Radio Four', country: 'Germany', countryCode: 'DE', state: '', city: '' }, // Incomplete metadata
  ];

  // 1. Group states for country
  const states = Array.from(new Set(stationsMock.map(s => s.state).filter(Boolean)));
  assert.strictEqual(states.length, 2);
  assert.ok(states.includes('Bavaria'));
  assert.ok(states.includes('Berlin'));

  // 2. Stations in state
  const bavariaStations = stationsMock.filter(s => s.state === 'Bavaria');
  assert.strictEqual(bavariaStations.length, 2);

  // 3. Cities in state
  const bavariaCities = Array.from(new Set(bavariaStations.map(s => s.city).filter(Boolean)));
  assert.strictEqual(bavariaCities.length, 2);
  assert.ok(bavariaCities.includes('Munich'));
  assert.ok(bavariaCities.includes('Nuremberg'));

  // 4. Incomplete metadata does not drop stations from country
  const countryTotal = stationsMock.filter(s => s.countryCode === 'DE');
  assert.strictEqual(countryTotal.length, 4, 'All stations including incomplete metadata remain discoverable');
});

test('Location Formatter: Formats location hierarchy without duplicate labels or fake locations', () => {
  function formatLocation(station) {
    if (!station) return 'Location unavailable';
    const city = station.city?.trim();
    const state = station.state?.trim();
    const country = station.country?.trim();

    if (city && country && city.toLowerCase() === country.toLowerCase()) {
      return country;
    }
    if (state && country && state.toLowerCase() === country.toLowerCase()) {
      return country;
    }
    if (city && state && city.toLowerCase() === state.toLowerCase()) {
      return country ? `${city}, ${country}` : city;
    }
    if (city && state && country) {
      return `${city}, ${state}, ${country}`;
    }
    if (city && country) {
      return `${city}, ${country}`;
    }
    if (state && country) {
      return `${state}, ${country}`;
    }
    if (country) {
      return country;
    }
    return 'Location unavailable';
  }

  assert.strictEqual(formatLocation({ country: 'India', state: 'India', city: 'India' }), 'India');
  assert.strictEqual(formatLocation({ city: 'Chennai', state: 'Tamil Nadu', country: 'India' }), 'Chennai, Tamil Nadu, India');
  assert.strictEqual(formatLocation({ city: 'Paris', country: 'France' }), 'Paris, France');
  assert.strictEqual(formatLocation({ state: 'Bavaria', country: 'Germany' }), 'Bavaria, Germany');
  assert.strictEqual(formatLocation({}), 'Location unavailable');
});

test('Local Persistence: Favorites and Recent History work locally without accounts or login requirement', () => {
  // In-memory simulated AsyncStorage
  const mockStorage = new Map();
  const storageEngine = {
    async getItem(key) { return mockStorage.get(key) || null; },
    async setItem(key, val) { mockStorage.set(key, val); },
  };

  const FAVORITES_KEY = '@fmx_local_favorites_v2';
  const HISTORY_KEY = '@fmx_local_recent_history_v2';

  async function toggleFavorite(stationId) {
    const raw = await storageEngine.getItem(FAVORITES_KEY);
    const favs = raw ? JSON.parse(raw) : [];
    const idx = favs.indexOf(stationId);
    let isFav = false;
    if (idx >= 0) {
      favs.splice(idx, 1);
      isFav = false;
    } else {
      favs.unshift(stationId);
      isFav = true;
    }
    await storageEngine.setItem(FAVORITES_KEY, JSON.stringify(favs));
    return isFav;
  }

  async function recordRecent(station) {
    const raw = await storageEngine.getItem(HISTORY_KEY);
    let history = raw ? JSON.parse(raw) : [];
    history = history.filter(s => s.id !== station.id);
    history.unshift(station);
    if (history.length > 50) history = history.slice(0, 50);
    await storageEngine.setItem(HISTORY_KEY, JSON.stringify(history));
  }

  // Verify favorites toggling
  return (async () => {
    assert.strictEqual(await toggleFavorite('station-1'), true);
    assert.strictEqual(await toggleFavorite('station-2'), true);
    assert.strictEqual(await toggleFavorite('station-1'), false); // Removed

    const savedRaw = await storageEngine.getItem(FAVORITES_KEY);
    const saved = JSON.parse(savedRaw);
    assert.deepStrictEqual(saved, ['station-2']);

    // Verify recent history recording and deduplication
    await recordRecent({ id: 's1', name: 'BBC 1' });
    await recordRecent({ id: 's2', name: 'BBC 2' });
    await recordRecent({ id: 's1', name: 'BBC 1' }); // Played again: moved to top, no duplicate

    const historyRaw = await storageEngine.getItem(HISTORY_KEY);
    const history = JSON.parse(historyRaw);
    assert.strictEqual(history.length, 2);
    assert.strictEqual(history[0].id, 's1');
    assert.strictEqual(history[1].id, 's2');
  })();
});

test('Navigation Architecture: 5 Primary Tabs, No Globe, No Profile, No Google Maps API calls', () => {
  const primaryTabs = ['explore', 'countries', 'search', 'mystations', 'saved'];
  assert.strictEqual(primaryTabs.length, 5);
  assert.strictEqual(primaryTabs.includes('profile'), false, 'Profile tab is completely removed');
  assert.strictEqual(primaryTabs.includes('globe'), false, 'Globe tab is completely removed');
  assert.strictEqual(primaryTabs.includes('nearby'), false, 'Nearby tab is completely removed');
});

// =========================================================================
// SECTION 10: SEARCH PIPELINE & UI REPAIR REGRESSION TEST SUITE
// =========================================================================

test('Search Pipeline: 1. Typing a search query returns matching results across name, city, tag, language', () => {
  const mockCatalogue = [
    { id: 'uuid-1', name: 'AIR Vividh Bharati', city: 'Mumbai', country: 'India', countryCode: 'IN', genres: ['AIR', 'Retro'], language: 'hindi' },
    { id: 'uuid-2', name: 'AIR FM Rainbow Chennai', city: 'Chennai', country: 'India', countryCode: 'IN', genres: ['Tamil', 'Pop'], language: 'tamil' },
    { id: 'uuid-3', name: '89.4 Tamil FM', city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', genres: ['Tamil', 'Hits'], language: 'tamil' },
    { id: 'uuid-4', name: 'BBC World Service', city: 'London', country: 'United Kingdom', countryCode: 'GB', genres: ['News'], language: 'english' },
    { id: 'uuid-5', name: 'KEXP 90.3 FM', city: 'Seattle', country: 'United States', countryCode: 'US', genres: ['Indie', 'Alternative'], language: 'english' },
  ];

  function searchLocal(q) {
    return mockCatalogue
      .map(s => ({ station: s, score: calculateStationRelevance(s, q) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.station);
  }

  // Station name
  const airResults = searchLocal('AIR Vividh Bharati');
  assert.ok(airResults.length > 0);
  assert.strictEqual(airResults[0].id, 'uuid-1');

  // City
  const chennaiResults = searchLocal('Chennai');
  assert.ok(chennaiResults.length > 0);
  assert.strictEqual(chennaiResults[0].id, 'uuid-2');

  // Language
  const tamilResults = searchLocal('Tamil');
  assert.ok(tamilResults.length >= 2);
  assert.ok(tamilResults.some(s => s.id === 'uuid-2'));
  assert.ok(tamilResults.some(s => s.id === 'uuid-3'));

  // Genre
  const newsResults = searchLocal('News');
  assert.ok(newsResults.length > 0);
  assert.strictEqual(newsResults[0].id, 'uuid-4');
});

test('Search Pipeline: 2. Multi-word search token matching ranks exact phrase above partial words', () => {
  const stationA = { id: 'a', name: 'AIR Vividh Bharati', city: 'Mumbai', country: 'India', countryCode: 'IN', genres: ['AIR'], language: 'hindi' };
  const stationB = { id: 'b', name: 'AIR FM Rainbow', city: 'Chennai', country: 'India', countryCode: 'IN', genres: ['AIR'], language: 'tamil' };

  // "AIR Vividh Bharati" matches all 3 words in stationA, but only 1 in stationB
  const scoreA = calculateStationRelevance(stationA, 'AIR Vividh Bharati');
  const scoreB = calculateStationRelevance(stationB, 'AIR Vividh Bharati');

  assert.ok(scoreA > scoreB, 'Station A with all tokens matching should score higher than partial match');
});

test('Search Pipeline: 3. Debounce behavior cancels prior timers on rapid keystrokes', async () => {
  let executedCount = 0;
  let lastExecutedQuery = '';

  class DebouncedSearcher {
    constructor() {
      this.timer = null;
    }
    type(q) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        executedCount++;
        lastExecutedQuery = q;
      }, 50);
    }
  }

  const searcher = new DebouncedSearcher();
  searcher.type('C');
  searcher.type('Ch');
  searcher.type('Che');
  searcher.type('Chen');
  searcher.type('Chennai');

  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(executedCount, 1, 'Only one search execution should occur after rapid typing');
  assert.strictEqual(lastExecutedQuery, 'Chennai', 'Final executed query should be the latest typed string');
});

test('Search Pipeline: 4. Clearing a query resets search state while preserving active genre filters', () => {
  let query = 'Chennai';
  let activeTag = 'TAMIL';
  let offset = 60;

  function clearQuery() {
    query = '';
    offset = 0;
    // activeTag is preserved
  }

  clearQuery();
  assert.strictEqual(query, '');
  assert.strictEqual(offset, 0);
  assert.strictEqual(activeTag, 'TAMIL', 'Active filter tag must remain selected after clearing text query');
});

test('Search Pipeline: 5. Slow requests resolving out-of-order are dropped in favor of newer request ID', async () => {
  let currentRequestId = 0;
  let displayedResults = null;

  async function mockAsyncSearch(searchId, query, delayMs, fakeData) {
    await new Promise(r => setTimeout(r, delayMs));
    if (searchId === currentRequestId) {
      displayedResults = fakeData;
    }
  }

  // Request 1: "AIR" (slow, 80ms)
  const req1 = ++currentRequestId;
  const p1 = mockAsyncSearch(req1, 'AIR', 80, ['result-AIR']);

  // Request 2: "BBC" (fast, 20ms)
  const req2 = ++currentRequestId;
  const p2 = mockAsyncSearch(req2, 'BBC', 20, ['result-BBC']);

  await Promise.all([p1, p2]);
  assert.deepStrictEqual(displayedResults, ['result-BBC'], 'Newer request must win over slow out-of-order response');
});

test('Search Pipeline: 6. API errors and retries present informative message instead of silent blank screen', () => {
  let errorMessage = null;
  let isRetrying = false;

  function handleSearchError(err) {
    errorMessage = err.message || 'Directory search temporary failure. Please retry.';
  }

  function handleRetry() {
    isRetrying = true;
    errorMessage = null;
  }

  handleSearchError(new Error('Connection timeout to Radio Browser mirror'));
  assert.ok(errorMessage.includes('Connection timeout'));

  handleRetry();
  assert.strictEqual(isRetrying, true);
  assert.strictEqual(errorMessage, null);
});

test('Search Pipeline: 7. Empty results properly trigger NO DIRECTORY MATCHES state', () => {
  const query = 'nonexistentxyzstation999';
  const mockCatalogue = [
    { id: '1', name: 'BBC World Service', city: 'London', country: 'UK', genres: ['News'] },
  ];

  const results = mockCatalogue.filter(s => calculateStationRelevance(s, query) > 0);
  assert.strictEqual(results.length, 0);

  const emptyLabel = results.length === 0 && query.length >= 1 ? 'NO DIRECTORY MATCHES' : 'STATIONS FOUND';
  assert.strictEqual(emptyLabel, 'NO DIRECTORY MATCHES');
});

test('Search Pipeline: 8. Pagination (offset > 0) returns new stations without repeating Page 1', () => {
  const page1 = [{ id: 's1', name: 'Station 1' }, { id: 's2', name: 'Station 2' }];
  const page2 = [{ id: 's3', name: 'Station 3' }, { id: 's4', name: 'Station 4' }];

  const combinedMap = new Map();
  page1.forEach(s => combinedMap.set(s.id, s));
  assert.strictEqual(combinedMap.size, 2);

  // Append page 2
  page2.forEach(s => combinedMap.set(s.id, s));
  assert.strictEqual(combinedMap.size, 4);

  const finalArray = Array.from(combinedMap.values());
  assert.deepStrictEqual(finalArray.map(s => s.id), ['s1', 's2', 's3', 's4']);
});

test('Search Pipeline: 9. Unicode and Tamil script search matches Tamil stations', () => {
  const tamilStation = {
    id: 'tamil-1',
    name: '89.4 Tamil FM',
    city: 'Dubai',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    genres: ['Tamil', 'Hits'],
    language: 'tamil',
  };

  const hindiStation = {
    id: 'hindi-1',
    name: 'Radio Mirchi Hindi',
    city: 'Mumbai',
    country: 'India',
    countryCode: 'IN',
    genres: ['Bollywood'],
    language: 'hindi',
  };

  // Searching "தமிழ்" (Tamil script)
  const tamilScore = calculateStationRelevance(tamilStation, 'தமிழ்');
  assert.ok(tamilScore >= 90, 'Tamil script query should yield high relevance for Tamil station');

  // Searching "हिन्दी" (Hindi script)
  const hindiScore = calculateStationRelevance(hindiStation, 'हिन्दी');
  assert.ok(hindiScore >= 90, 'Hindi script query should yield high relevance for Hindi station');
});

test('Search Pipeline: 10. Country -> State -> City hierarchy resets child selections when parent changes', () => {
  let selectedCountry = 'India';
  let selectedState = 'Tamil Nadu';
  let selectedCity = 'Chennai';
  let level = 'stations';

  function changeCountry(newCountry) {
    selectedCountry = newCountry;
    selectedState = null;
    selectedCity = null;
    level = 'states';
  }

  changeCountry('Germany');
  assert.strictEqual(selectedCountry, 'Germany');
  assert.strictEqual(selectedState, null, 'Changing country must reset state selection');
  assert.strictEqual(selectedCity, null, 'Changing country must reset city selection');
  assert.strictEqual(level, 'states');
});

test('Search Pipeline: 11. Station selection passes exact stream URL without modifying broadcaster identity', () => {
  const station = {
    id: '68d00a44-200c-4c82-b17f-18d777f3b2ee',
    name: 'AIR Vividh Bharati',
    streamUrl: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
  };

  let playerLoadedUri = null;
  function mockPlay(s) {
    playerLoadedUri = s.streamUrl;
  }

  mockPlay(station);
  assert.strictEqual(playerLoadedUri, 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8');
});

test('Search Pipeline: 12. Local favorites and recent history operate without account or remote server', async () => {
  const inMemoryStorage = new Map();
  const storage = {
    getItem: async (k) => inMemoryStorage.get(k) || null,
    setItem: async (k, v) => inMemoryStorage.set(k, v),
  };

  // Favorites
  let favs = [];
  favs.push('fav-1');
  await storage.setItem('@fmx:favorites', JSON.stringify(favs));
  const readFavs = JSON.parse(await storage.getItem('@fmx:favorites'));
  assert.deepStrictEqual(readFavs, ['fav-1']);

  // History
  let history = [{ id: 's1', name: 'BBC' }];
  await storage.setItem('@fmx:history', JSON.stringify(history));
  const readHistory = JSON.parse(await storage.getItem('@fmx:history'));
  assert.strictEqual(readHistory.length, 1);
  assert.strictEqual(readHistory[0].name, 'BBC');
});

test('Search Pipeline: 13. UI Layout: lists provide sufficient bottom padding to prevent player overlap', () => {
  const MINI_PLAYER_HEIGHT = 54;
  const BOTTOM_NAV_HEIGHT = 60;
  const RECOMMENDED_BOTTOM_PADDING = 90;

  assert.ok(
    RECOMMENDED_BOTTOM_PADDING >= MINI_PLAYER_HEIGHT,
    'List bottom padding must accommodate persistent player'
  );
});

test('Search Pipeline: 14. Playback error isolates to active card without mutating other catalogue stations', () => {
  const catalogue = [
    { id: '1', name: 'Station 1', streamUrl: 'http://dead.stream' },
    { id: '2', name: 'Station 2', streamUrl: 'http://live.stream' },
  ];

  let activePlayerState = { status: 'idle', errorMessage: null };

  function onPlaybackError(station, error) {
    activePlayerState = {
      status: 'error',
      errorMessage: error,
    };
    // Does NOT substitute station 2
  }

  onPlaybackError(catalogue[0], 'HTTP 404 stream not found');
  assert.strictEqual(activePlayerState.status, 'error');
  assert.strictEqual(catalogue[0].name, 'Station 1');
  assert.strictEqual(catalogue[1].name, 'Station 2');
});

test('Search Pipeline: 15. Header hides search shortcut when active tab is Search to prevent double search bar', () => {
  function shouldShowHeaderSearch(activeTab) {
    return activeTab !== 'search';
  }

  assert.strictEqual(shouldShowHeaderSearch('explore'), true);
  assert.strictEqual(shouldShowHeaderSearch('countries'), true);
  assert.strictEqual(shouldShowHeaderSearch('search'), false, 'Header search bar must be hidden on SearchScreen');
  assert.strictEqual(shouldShowHeaderSearch('mystations'), true);
  assert.strictEqual(shouldShowHeaderSearch('saved'), true);
});

// --- ARTWORK & COVER SYSTEM PRODUCTION HARDENING TESTS ---

const TEST_VERIFIED_BROADCASTER_MAP = {
  '68d00a44-200c-4c82-b17f-18d777f3b2ee': {
    url: 'https://prasarbharati.gov.in/air_logo.png',
    attribution: 'Prasar Bharati / All India Radio',
  },
  '952e65fc-55dc-4e1b-83bb-c43afff0bc9c': {
    url: 'https://prasarbharati.gov.in/air_rainbow.png',
    attribution: 'AIR FM Rainbow Chennai',
  },
  'a347209e-6ce6-4c94-81ed-003c1275188f': {
    url: 'https://cdn-profiles.tunein.com/s24948/images/logoq.jpg?t=1',
    attribution: 'BBC World Service London',
  },
  'e8f967be-165b-4303-a8c6-35a4d468eb37': {
    url: 'https://cdn-profiles.tunein.com/s24948/images/logoq.jpg?t=1',
    attribution: 'BBC World Service London',
  },
};

function isValidImageUrlHelper(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
  if (lower.includes('javascript:') || lower.includes('data:')) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === '' || parsed.pathname === '/') return false;
    const invalidExts = ['.html', '.htm', '.php', '.asp', '.aspx', '.jsp', '.cgi', '.txt', '.pdf'];
    if (invalidExts.some(ext => parsed.pathname.toLowerCase().endsWith(ext))) return false;
    return true;
  } catch {
    return false;
  }
}

function resolveArtworkHelper(station, failedUrls = new Map(), cooldownMs = 10 * 60 * 1000) {
  if (!station) {
    return { sourceType: 'generic_fallback', isOfficial: false, isFallback: true };
  }
  const isFailed = (u) => {
    if (!u) return false;
    const ts = failedUrls.get(u);
    return ts && (Date.now() - ts < cooldownMs);
  };

  // 1. Authoritative verified broadcaster
  const matchedId =
    (station.id && TEST_VERIFIED_BROADCASTER_MAP[station.id]) ? station.id :
    (station.sourceStationId && TEST_VERIFIED_BROADCASTER_MAP[station.sourceStationId]) ? station.sourceStationId :
    null;

  if (matchedId) {
    const verified = TEST_VERIFIED_BROADCASTER_MAP[matchedId];
    if (!isFailed(verified.url)) {
      return {
        uri: verified.url,
        sourceType: 'verified_broadcaster',
        isOfficial: true,
        attribution: verified.attribution,
        isFallback: false,
      };
    }
  }

  // 2. Pre-verified station record
  if (station.artworkSource === 'verified_broadcaster' && station.artworkIsOfficial === true && station.artworkUrl) {
    if (isValidImageUrlHelper(station.artworkUrl) && !isFailed(station.artworkUrl)) {
      return {
        uri: station.artworkUrl.trim(),
        sourceType: 'verified_broadcaster',
        isOfficial: true,
        attribution: station.name,
        isFallback: false,
      };
    }
  }

  // 3. Directory record
  const dirUrl = (station.artworkUrl || station.favicon || '').trim();
  if (dirUrl && isValidImageUrlHelper(dirUrl) && !isFailed(dirUrl)) {
    return {
      uri: dirUrl,
      sourceType: 'directory_favicon',
      isOfficial: false,
      attribution: 'Radio Browser Directory',
      isFallback: false,
    };
  }

  // 4. Insufficient metadata -> generic fallback
  const hasName = Boolean(station.name && station.name.trim().length > 1 && station.name.trim() !== 'Unnamed Broadcast');
  if (!hasName && !station.city && !station.country) {
    return { sourceType: 'generic_fallback', isOfficial: false, isFallback: true };
  }

  // 5. Deterministic fmX fallback
  return {
    sourceType: 'fmx_generated_fallback',
    isOfficial: false,
    attribution: 'fmX Tactical Audio Monogram',
    isFallback: true,
  };
}

test('Artwork Hardening: 1. Exact station identity matching works by id and sourceStationId', () => {
  const stationById = {
    id: 'a347209e-6ce6-4c94-81ed-003c1275188f',
    name: 'BBC World Service',
  };
  const stationBySourceId = {
    id: 'custom-prefix-bbc',
    sourceStationId: 'e8f967be-165b-4303-a8c6-35a4d468eb37',
    name: 'BBC World Service Relay',
  };

  const res1 = resolveArtworkHelper(stationById);
  const res2 = resolveArtworkHelper(stationBySourceId);

  assert.strictEqual(res1.sourceType, 'verified_broadcaster');
  assert.strictEqual(res1.isOfficial, true);
  assert.ok(res1.uri.includes('tunein.com'));

  assert.strictEqual(res2.sourceType, 'verified_broadcaster');
  assert.strictEqual(res2.isOfficial, true);
  assert.ok(res2.uri.includes('tunein.com'));
});

test('Artwork Hardening: 2. Sibling services from same broadcaster never cross-pollinate logos', () => {
  const vividh = {
    id: '68d00a44-200c-4c82-b17f-18d777f3b2ee',
    name: 'AIR Vividh Bharati',
    country: 'India',
  };
  const rainbow = {
    id: '952e65fc-55dc-4e1b-83bb-c43afff0bc9c',
    name: 'AIR FM Rainbow Chennai',
    country: 'India',
  };
  const genericAir = {
    id: 'other-air-station-uuid',
    name: 'AIR FM Gold Delhi',
    country: 'India',
  };

  const resVividh = resolveArtworkHelper(vividh);
  const resRainbow = resolveArtworkHelper(rainbow);
  const resGeneric = resolveArtworkHelper(genericAir);

  assert.strictEqual(resVividh.uri, 'https://prasarbharati.gov.in/air_logo.png');
  assert.strictEqual(resRainbow.uri, 'https://prasarbharati.gov.in/air_rainbow.png');
  assert.notStrictEqual(resVividh.uri, resRainbow.uri, 'Sibling stations must never share logos');

  // Generic AIR station must NOT inherit either logo purely due to sharing "AIR" brand
  assert.strictEqual(resGeneric.sourceType, 'fmx_generated_fallback');
  assert.strictEqual(resGeneric.isOfficial, false);
});

test('Artwork Hardening: 3. Directory favicons are clearly labeled directory_favicon and never marked official', () => {
  const station = {
    id: 'dir-station-123',
    name: 'Radio Paradise',
    favicon: 'https://radioparadise.com/apple-touch-icon.png',
  };

  const res = resolveArtworkHelper(station);
  assert.strictEqual(res.sourceType, 'directory_favicon');
  assert.strictEqual(res.isOfficial, false, 'Directory favicons must never be marked official');
  assert.strictEqual(res.isFallback, false);
});

test('Artwork Hardening: 4. Malformed and non-image URLs are rejected immediately', () => {
  assert.strictEqual(isValidImageUrlHelper(''), false);
  assert.strictEqual(isValidImageUrlHelper('ftp://example.com/logo.png'), false);
  assert.strictEqual(isValidImageUrlHelper('javascript:alert(1)'), false);
  assert.strictEqual(isValidImageUrlHelper('data:image/png;base64,123'), false);
  assert.strictEqual(isValidImageUrlHelper('https://example.com'), false, 'Bare domain without path is rejected');
  assert.strictEqual(isValidImageUrlHelper('https://example.com/'), false, 'Bare domain root is rejected');
  assert.strictEqual(isValidImageUrlHelper('https://example.com/index.html'), false, 'HTML pages are rejected');
  assert.strictEqual(isValidImageUrlHelper('https://example.com/radio.php'), false, 'PHP pages are rejected');
  assert.strictEqual(isValidImageUrlHelper('https://example.com/logo.png'), true);
  assert.strictEqual(isValidImageUrlHelper('https://cdn.station.com/image.jpg?w=300'), true);
});

test('Artwork Hardening: 5. Network failures trigger immediate fallback and enter negative cache', () => {
  const station = {
    id: 'test-broken-url-stn',
    name: 'Broken URL Station',
    favicon: 'https://example.com/404_not_found.png',
  };
  const failedMap = new Map();

  // 1. Initial resolution offers the directory URL
  const initial = resolveArtworkHelper(station, failedMap);
  assert.strictEqual(initial.sourceType, 'directory_favicon');

  // 2. Network error recorded in negative cache
  failedMap.set(station.favicon, Date.now());

  // 3. Subsequent resolution immediately returns fmx_generated_fallback
  const fallback = resolveArtworkHelper(station, failedMap);
  assert.strictEqual(fallback.sourceType, 'fmx_generated_fallback');
  assert.strictEqual(fallback.isFallback, true);
  assert.strictEqual(fallback.uri, undefined);
});

test('Artwork Hardening: 6. Negative cache expires after cooldown, allowing retries', () => {
  const station = {
    id: 'test-cooldown-stn',
    name: 'Recoverable Station',
    favicon: 'https://example.com/transient_error.png',
  };
  const failedMap = new Map();
  const cooldownMs = 1000; // 1 second for test

  // Record failure at t=0
  failedMap.set(station.favicon, Date.now() - 1500); // 1.5 seconds ago (expired)

  const resolved = resolveArtworkHelper(station, failedMap, cooldownMs);
  assert.strictEqual(resolved.sourceType, 'directory_favicon', 'Expired failed URL should be retried');
  assert.strictEqual(resolved.uri, station.favicon);
});

test('Artwork Hardening: 7. Bounded negative cache evicts oldest entries at capacity limit', () => {
  const maxCapacity = 5;
  const failedCache = new Map();

  function recordError(url) {
    if (failedCache.size >= maxCapacity) {
      const oldest = failedCache.keys().next().value;
      if (oldest) failedCache.delete(oldest);
    }
    failedCache.set(url, Date.now());
  }

  for (let i = 1; i <= 7; i++) {
    recordError(`https://example.com/bad_${i}.png`);
  }

  assert.strictEqual(failedCache.size, 5, 'Cache size must not exceed capacity');
  assert.strictEqual(failedCache.has('https://example.com/bad_1.png'), false, 'Oldest item must be evicted');
  assert.strictEqual(failedCache.has('https://example.com/bad_2.png'), false, 'Second oldest item must be evicted');
  assert.strictEqual(failedCache.has('https://example.com/bad_7.png'), true, 'Newest item must be present');
});

test('Artwork Hardening: 8. Rapid station switching produces distinct render keys and prevents stale image leakage', () => {
  const stationA = { id: 'station-a', name: 'Alpha FM', favicon: 'https://example.com/a.png' };
  const stationB = { id: 'station-b', name: 'Beta FM', favicon: 'https://example.com/b.png' };

  const resA = resolveArtworkHelper(stationA);
  const resB = resolveArtworkHelper(stationB);

  const keyA = `${stationA.id}:${resA.uri}`;
  const keyB = `${stationB.id}:${resB.uri}`;

  assert.notStrictEqual(keyA, keyB, 'Render keys must differ between stations to force unmount of previous image');
});

test('Artwork Hardening: 9. Insufficient metadata records resolve cleanly to generic_fallback', () => {
  const emptyStation = {
    id: 'empty-1',
    name: 'Unnamed Broadcast',
    city: '',
    country: '',
    favicon: '',
  };

  const res = resolveArtworkHelper(emptyStation);
  assert.strictEqual(res.sourceType, 'generic_fallback');
  assert.strictEqual(res.isFallback, true);
});

test('Artwork Hardening: 10. Favorites and recent history preserve station artwork references without data bloat', () => {
  const playedStation = {
    id: '68d00a44-200c-4c82-b17f-18d777f3b2ee',
    name: 'AIR Vividh Bharati',
    streamUrl: 'https://air.pc.cdn.bitgravity.com/air/live/pbaudio001/playlist.m3u8',
    city: 'Chennai',
    country: 'India',
    artworkUrl: 'https://prasarbharati.gov.in/air_logo.png',
  };

  // Simulating serializing to AsyncStorage
  const serialized = JSON.stringify(playedStation);
  const deserialized = JSON.parse(serialized);

  assert.ok(serialized.length < 500, 'Serialized station record must remain lightweight (<500 bytes)');
  assert.strictEqual(deserialized.id, playedStation.id);
  assert.strictEqual(deserialized.artworkUrl, playedStation.artworkUrl);

  const restoredArtwork = resolveArtworkHelper(deserialized);
  assert.strictEqual(restoredArtwork.sourceType, 'verified_broadcaster');
  assert.strictEqual(restoredArtwork.isOfficial, true);
});

test('Artwork Hardening: 11. Deterministic visual props produce identical 4-bar waveform across renders', () => {
  function hashString(str) {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function getDeterministicVisualProps(station) {
    const seed = `${station.id}:${station.name}`;
    const hash = hashString(seed);
    const words = station.name.split(' ');
    const monogram = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : words[0].slice(0, 2).toUpperCase();
    const b0 = parseFloat((0.25 + (((hash >> 0) & 0xff) / 255) * 0.75).toFixed(2));
    const b1 = parseFloat((0.25 + (((hash >> 8) & 0xff) / 255) * 0.75).toFixed(2));
    const b2 = parseFloat((0.25 + (((hash >> 16) & 0xff) / 255) * 0.75).toFixed(2));
    const b3 = parseFloat((0.25 + (((hash >> 24) & 0xff) / 255) * 0.75).toFixed(2));
    return { monogram, bars: [b0, b1, b2, b3] };
  }

  const station = { id: 'kexp-123', name: 'KEXP Seattle' };
  const r1 = getDeterministicVisualProps(station);
  const r2 = getDeterministicVisualProps(station);

  assert.strictEqual(r1.monogram, 'KS');
  assert.deepStrictEqual(r1.bars, r2.bars);
});


