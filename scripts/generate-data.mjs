#!/usr/bin/env node
/**
 * Builds public/data.json from:
 *   - the seed data.json in the project root (schema 2.0, kept intact and enriched)
 *   - the curated catalogue in scripts/catalog/*
 *
 * It resolves photos + verifies coordinates through the Wikipedia REST API
 * (cached in scripts/.cache/wikipedia.json) and pre-computes multi-day itineraries
 * with timed stops and routes for every place.
 *
 * Usage:
 *   node scripts/generate-data.mjs            # uses network for uncached Wikipedia lookups
 *   node scripts/generate-data.mjs --offline  # cache only, no network
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { CITIES, CLIMATE_ZONES, SEED_ZONE_OVERRIDES } from './catalog/cities.mjs';
import { PLACES_SOUTH } from './catalog/places-south.mjs';
import { PLACES_CENTRAL } from './catalog/places-central.mjs';
import { PLACES_NORTH } from './catalog/places-north.mjs';
import { SEED_OVERRIDES, SEED_EXTRA_TAGS } from './catalog/seed-overrides.mjs';
import { IMAGE_OVERRIDES } from './catalog/image-overrides.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEED_PATH = path.join(ROOT, 'data.json');
const OUT_PATH = path.join(ROOT, 'public', 'data.json');
const CACHE_DIR = path.join(ROOT, 'scripts', '.cache');
const CACHE_PATH = path.join(CACHE_DIR, 'wikipedia.json');
const OFFLINE = process.argv.includes('--offline');
const USER_AGENT = 'Reitti/1.0 (educational project; data generator)';

const MAX_TRIP_DAYS = 5;
const MAX_DAY_TRIPS = 2;
const DAY_BUDGET_MIN = 8 * 60; // 09:00 – 17:00 sightseeing window
const DAY_START_MIN = 9 * 60;
const ROAD_FACTOR = 1.25;
const NEARBY_CITY_KM = 110;

// ---------------------------------------------------------------- utilities
const toRad = (d) => (d * Math.PI) / 180;
const round1 = (n) => Math.round(n * 10) / 10;
const ceil5 = (n) => Math.ceil(n / 5) * 5;
const pad = (n) => String(n).padStart(2, '0');
const hhmm = (mins) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function slugTitle(t) {
  return t.replace(/ /g, '_');
}

function daylightHours(lat, month) {
  const doy = [15, 46, 74, 105, 135, 166, 196, 227, 258, 288, 319, 349][month - 1];
  const decl = toRad(-23.44 * Math.cos(((2 * Math.PI) / 365) * (doy + 10)));
  const phi = toRad(lat);
  const cosH = (Math.sin(toRad(-0.833)) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  if (cosH <= -1) return 24;
  if (cosH >= 1) return 0;
  return round1((2 * ((Math.acos(cosH) * 180) / Math.PI)) / 15);
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function seasonLabel(months) {
  if (!months || months.length === 12) return 'Year-round';
  // find contiguous run (wrapping) for a nice label
  const set = new Set(months);
  let start = months[0];
  while (set.has(((start + 10) % 12) + 1) && ((start + 10) % 12) + 1 !== months[0]) start = ((start + 10) % 12) + 1;
  let end = start;
  while (set.has((end % 12) + 1) && (end % 12) + 1 !== start) end = (end % 12) + 1;
  if (start === end) return `${MONTH_SHORT[start - 1]} only`;
  return `${MONTH_SHORT[start - 1]}–${MONTH_SHORT[end - 1]}`;
}

const TAG_LABELS = {
  national_park: 'National Park',
  urban_nature: 'Urban Nature',
  unesco: 'UNESCO',
  theme: 'Theme Park',
  birdwatching: 'Birdwatching',
};
const tagLabel = (t) => TAG_LABELS[t] ?? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ');

const INDOOR_TAGS = new Set(['indoor', 'museum']);
const OUTDOOR_TAGS = new Set(['nature', 'hiking', 'national_park', 'beach', 'park', 'garden', 'walking', 'skiing', 'island', 'coastal', 'views', 'aurora']);

function isIndoor(tags) {
  if (tags.includes('indoor')) return true;
  if (tags.some((t) => OUTDOOR_TAGS.has(t))) return false;
  return tags.some((t) => INDOOR_TAGS.has(t)) || tags.includes('church') || tags.includes('sauna');
}

function visitType(tags) {
  if (tags.includes('sauna') || tags.includes('relaxation')) return 'relaxation';
  if (tags.includes('museum') || tags.includes('science')) return 'museum';
  if (tags.some((t) => ['skiing', 'adventure', 'aurora', 'theme', 'entertainment'].includes(t))) return 'activity';
  if (tags.some((t) => ['national_park', 'hiking', 'nature', 'beach', 'park', 'garden', 'lake'].includes(t))) return 'nature';
  if (tags.some((t) => ['church', 'culture', 'music', 'art', 'design'].includes(t))) return 'culture';
  return 'attraction';
}

const THEME_PHRASES = [
  ['aurora', 'Northern Lights Night'],
  ['skiing', 'Slopes & Snow'],
  ['winter', 'Winter Adventures'],
  ['national_park', 'Wilderness & National Park'],
  ['hiking', 'Trails & Viewpoints'],
  ['unesco', 'UNESCO Heritage'],
  ['castle', 'Castles & Fortresses'],
  ['theme', 'Family Fun Day'],
  ['family', 'Family Fun Day'],
  ['sauna', 'Sauna & Relaxation'],
  ['beach', 'Beach & Coast'],
  ['island', 'Island Escape'],
  ['museum', 'Museums & Culture'],
  ['art', 'Art & Design'],
  ['design', 'Art & Design'],
  ['architecture', 'Architecture Walk'],
  ['history', 'Historic Highlights'],
  ['food', 'Markets & Local Flavours'],
  ['lake', 'Lakeland Day'],
  ['nature', 'Nature & Outdoors'],
  ['views', 'Viewpoints & Panoramas'],
];

function themeFor(visits) {
  const score = new Map();
  for (const v of visits) {
    for (const t of v.tags) score.set(t, (score.get(t) ?? 0) + v.dur);
  }
  let best = null;
  let bestScore = -1;
  for (const [tag, phrase] of THEME_PHRASES) {
    const s = score.get(tag) ?? 0;
    if (s > bestScore) {
      best = phrase;
      bestScore = s;
    }
  }
  return bestScore > 0 ? best : 'City Highlights';
}

function monthsOverlap(a, b) {
  if (!a || !b) return true;
  return a.some((m) => b.includes(m));
}

// ---------------------------------------------------------------- images
function normalizeImageUrl(url, width = 1280) {
  if (!url) return null;
  const commons = url.match(/^https?:\/\/commons\.wikimedia\.org\/wiki\/File:(.+)$/);
  if (commons) return `https://commons.wikimedia.org/wiki/Special:FilePath/${commons[1]}?width=${width}`;
  if (/images\.unsplash\.com/.test(url)) {
    const base = url.split('?')[0];
    return `${base}?auto=format&fit=crop&w=${width}&q=70`;
  }
  return url;
}

function sizedWikiThumb(thumbUrl, width) {
  return thumbUrl.replace(/\/\d+px-/, `/${width}px-`);
}

function pickWikiImage(summary) {
  const orig = summary.originalimage;
  const thumb = summary.thumbnail;
  if (!orig || !thumb) return null;
  const name = decodeURIComponent(orig.source.split('/').pop() ?? '').toLowerCase();
  if (/\.svg$|coat_of_arms|logo|flag|locator|map|vaakuna|seal/.test(name)) return null;
  const strip = (u) => u.split('?')[0];
  const image = orig.width > 1280 ? sizedWikiThumb(strip(thumb.source), 1280) : wikimediaThumb(strip(orig.source), orig.width, 1280);
  const small = orig.width > 500 ? sizedWikiThumb(strip(thumb.source), 500) : wikimediaThumb(strip(orig.source), orig.width, 500);
  return { image, thumb: small };
}

// ---------------------------------------------------------------- wikipedia cache
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadCache() {
  if (!existsSync(CACHE_PATH)) return {};
  return JSON.parse(await readFile(CACHE_PATH, 'utf8'));
}

async function fetchWikiSummary(title, cache) {
  if (!title) return null;
  if (title in cache) return cache[title];
  if (OFFLINE) return null;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slugTitle(title))}?redirect=true`;
  try {
    let res;
    for (let attempt = 0; attempt < 6; attempt++) {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
      if (res.status !== 429 && res.status < 500) break;
      const retryAfter = Number(res.headers.get('retry-after')) || 2 ** attempt;
      await sleep(Math.min(30, retryAfter) * 1000);
    }
    if (res.status === 404) {
      cache[title] = null; // page genuinely does not exist
      return null;
    }
    if (!res.ok) {
      console.warn(`  ! wikipedia lookup for "${title}" failed with HTTP ${res.status} (not cached)`);
      return null;
    }
    const s = await res.json();
    if (s.type === 'disambiguation') {
      cache[title] = null;
      return null;
    }
    const img = pickWikiImage(s);
    cache[title] = {
      title: s.title,
      url: s.content_urls?.desktop?.page ?? null,
      lat: s.coordinates?.lat ?? null,
      lon: s.coordinates?.lon ?? null,
      image: img?.image ?? null,
      thumb: img?.thumb ?? null,
    };
    await sleep(250); // be polite to the API
    return cache[title];
  } catch (err) {
    console.warn(`  ! wikipedia lookup failed for "${title}": ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------- wikimedia images
// Always emit standard-width thumbnails: originals and Special:FilePath links get rate-limited (429).
const WIKIMEDIA_STEPS = [250, 330, 500, 960, 1280, 1920];
const BAD_FILE_NAME = /\.(svg|tiff?|pdf|djvu|webm|ogv|gif)$|coat_of_arms|logo|flag|locator|map|kartta|vaakuna|seal|diagram|plan|sign|stamp|poster|drawing|chart/;

async function wikimediaApi(host, params) {
  const url = `https://${host}/w/api.php?${new URLSearchParams({ ...params, format: 'json', formatversion: '2' })}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (res.ok) {
      await sleep(250);
      return res.json();
    }
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    await sleep(Math.min(30, Number(res.headers.get('retry-after')) || 2 ** attempt) * 1000);
  }
  throw new Error('rate limited');
}

/** Thumbnail URL for an original upload.wikimedia.org file, never wider than the original. */
function wikimediaThumb(originalUrl, originalWidth, target) {
  originalUrl = originalUrl.split(/[?#]/)[0];
  const m = originalUrl.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/([^/]+)\/([0-9a-f])\/([0-9a-f]{2})\/([^/?#]+)$/);
  if (!m) return originalUrl;
  const step = [...WIKIMEDIA_STEPS].reverse().find((w) => w <= target && w < originalWidth);
  if (!step) return originalUrl; // tiny original: nothing smaller to serve
  const [, project, a, ab, file] = m;
  return `https://upload.wikimedia.org/wikipedia/${project}/thumb/${a}/${ab}/${file}/${step}px-${file}`;
}

/** Identify the Wikimedia file behind a File: page, Special:FilePath link or upload URL. */
function wikimediaFileRef(url) {
  if (!url) return null;
  let m = url.match(/^https?:\/\/commons\.wikimedia\.org\/wiki\/(?:File:|Special:FilePath\/)([^?#]+)/);
  if (m) return { host: 'commons.wikimedia.org', title: decodeURIComponent(m[1]).replace(/_/g, ' ') };
  m = url.match(/^https?:\/\/(?:upload|thumb)\.wikimedia\.org\/wikipedia\/([^/]+)\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#]+)/);
  if (m) {
    const host = m[1] === 'commons' ? 'commons.wikimedia.org' : `${m[1]}.wikipedia.org`;
    return { host, title: decodeURIComponent(m[2]).replace(/_/g, ' ') };
  }
  return null;
}

/** Original URL + size of a Wikimedia file (cached). null = file does not exist. */
async function wikimediaFileInfo(ref, cache) {
  const key = `__fileinfo__${ref.host}:${ref.title}`;
  if (key in cache) return cache[key];
  if (OFFLINE) return undefined;
  try {
    const r = await wikimediaApi(ref.host, {
      action: 'query',
      titles: `File:${ref.title}`,
      prop: 'imageinfo',
      iiprop: 'url|size|mime',
    });
    const info = r.query?.pages?.[0]?.imageinfo?.[0];
    cache[key] = info ? { url: info.url, width: info.width, height: info.height, mime: info.mime } : null;
  } catch (err) {
    console.warn(`  ! file lookup failed for ${ref.title}: ${err.message}`);
    return undefined; // transient: not cached
  }
  return cache[key];
}

/**
 * Turns any Wikimedia image link into reliable thumbnail URLs.
 * Returns { image, thumb } or null when the file is gone; non-Wikimedia URLs are passed through.
 */
async function resolveImage(url, cache, { large = 1280, small = 500 } = {}) {
  if (!url) return null;
  const ref = wikimediaFileRef(url);
  if (!ref) return { image: normalizeImageUrl(url, large), thumb: normalizeImageUrl(url, small) };
  const info = await wikimediaFileInfo(ref, cache);
  if (info === null) return null;
  if (info === undefined) return { image: url, thumb: url }; // offline / transient failure: keep as is
  return { image: wikimediaThumb(info.url, info.width, large), thumb: wikimediaThumb(info.url, info.width, small) };
}

const foldText = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const GENERIC_WORDS = new Set(
  'museum museo centre center park nature trail reserve house church chapel garden island islands village area fell hike summit safari ride night tour cruise river lake beach beaches harbour market square old town ski resort snow hotel sauna smoke farm reindeer husky sled sledge glass igloo aurora northern lights snowmobile outdoor modern science cultural culture forest'.split(' '),
);

/** Distinctive words a photo title should mention when the file carries no geotag. */
function relevanceTokens(name, cityName) {
  const words = foldText(`${name} ${cityName}`).split(/[^a-z0-9]+/);
  return [...new Set(words.filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w)))];
}

function usablePhoto(page, near, maxKm, tokens) {
  const ii = page.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png)$/.test(ii.mime)) return false;
  if (ii.width < 800 || ii.height < 450) return false;
  const ratio = ii.width / ii.height;
  if (ratio < 0.7 || ratio > 2.6) return false;
  if (BAD_FILE_NAME.test(page.title.toLowerCase())) return false;
  const c = page.coordinates?.[0];
  if (c && near && haversineKm(near, { lat: c.lat, lon: c.lon }) > maxKm) return false;
  // without a geotag, the file name must mention the place or city
  if (!c && tokens?.length && !tokens.some((t) => foldText(page.title).includes(t))) return false;
  return true;
}

/**
 * Finds a Commons photo for a place that has no Wikipedia image:
 * full-text search on "<name> <city>", then "<name>", then photos geotagged near the place.
 */
async function findCommonsPhoto(place, cityName, cache) {
  const key = `__commons_photo_v1__${place.id}`;
  if (key in cache) return cache[key];
  if (OFFLINE) return null;
  const name = place.name.replace(/\s*\([^)]*\)/g, '').trim();
  const near = { lat: place.lat, lon: place.lon };
  const tokens = relevanceTokens(name, cityName);
  const common ={ action: 'query', prop: 'imageinfo|coordinates', iiprop: 'url|size|mime' };
  const queries = [
    { generator: 'search', gsrnamespace: '6', gsrlimit: '15', gsrsearch: `${name} ${cityName} filetype:bitmap` },
    { generator: 'search', gsrnamespace: '6', gsrlimit: '15', gsrsearch: `${name} filetype:bitmap` },
    { generator: 'geosearch', ggsnamespace: '6', ggslimit: '30', ggsradius: '1500', ggscoord: `${place.lat}|${place.lon}` },
  ];
  try {
    for (const q of queries) {
      const r = await wikimediaApi('commons.wikimedia.org', { ...common, ...q });
      const pages = (r.query?.pages ?? []).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      const hit = pages.find((pg) => usablePhoto(pg, near, q.generator === 'geosearch' ? 2 : 20, tokens));
      if (hit) {
        const ii = hit.imageinfo[0];
        cache[key] = { file: hit.title, url: ii.url, width: ii.width, height: ii.height, mime: ii.mime };
        return cache[key];
      }
    }
    cache[key] = null;
  } catch (err) {
    console.warn(`  ! commons photo search failed for ${place.id}: ${err.message}`);
    return null;
  }
  return cache[key];
}

// ---------------------------------------------------------------- planner
function makeLeg(from, to, city, target) {
  const straight = haversineKm(from, to);
  const ferry = target?.access === 'ferry' && straight > 0.5;
  const km = ferry ? straight : straight * ROAD_FACTOR;
  if (km < 0.15) return null;
  if (ferry) {
    return {
      mode: 'Ferry',
      verb: 'Ferry / boat',
      km,
      mins: ceil5(15 + (km / 20) * 60),
      cost: target.cost > 0 ? 0 : 4,
      notes: target.cost > 0 ? 'Boat fare is included in the attraction’s estimated cost.' : 'Check the seasonal ferry timetable before you go.',
    };
  }
  if (km < 1.6) {
    return { mode: 'Walking', verb: 'Walk', km, mins: ceil5(2 + (km / 4.5) * 60), cost: 0, notes: `About ${round1(km)} km on foot.` };
  }
  if (km < 18) {
    const transit = city.tram ? 'Tram' : 'Bus';
    return {
      mode: transit,
      verb: city.tram ? 'Tram / bus' : 'Local bus',
      km,
      mins: ceil5(10 + (km / 18) * 60),
      cost: city.id === 'helsinki' || city.id === 'espoo' || city.id === 'vantaa' ? 3.2 : 3,
      notes: `${round1(km)} km by public transport — buy tickets in the local transit app.`,
    };
  }
  return {
    mode: 'Car / Regional Bus',
    verb: 'Drive or regional bus',
    km,
    mins: ceil5(10 + (km / 65) * 60),
    cost: Math.round(Math.min(45, 4 + km * 0.14)),
    notes: `${Math.round(km)} km — a rental car gives the most flexibility; regional buses run less often.`,
  };
}

const MODE_ORDER = ['Car / Regional Bus', 'Ferry', 'Tram', 'Bus', 'Walking'];

function summarizeModes(modes) {
  const set = new Set(modes);
  if (set.size === 0) set.add('Walking');
  if (!set.has('Walking')) set.add('Walking');
  return MODE_ORDER.filter((m) => set.has(m)).join(' + ');
}

/** Greedy nearest-neighbour cluster of visits for one day. */
function buildDay(seed, candidates, used, city, anchorMonths) {
  const visits = [seed];
  used.add(seed.id);
  let evening = seed.best === 'Evening' ? seed : null;
  const bigDay = seed.dur >= 300;
  let total = seed.best === 'Evening' ? 0 : seed.dur + (makeLeg(city.hub, seed, city, seed)?.mins ?? 0);
  if (bigDay) return visits;

  let last = seed;
  while (visits.length < 4) {
    let best = null;
    let bestKm = Infinity;
    for (const c of candidates) {
      if (used.has(c.id)) continue;
      if (!monthsOverlap(c.months, anchorMonths) || !monthsOverlap(c.months, seed.months)) continue;
      if (c.dur >= 240) continue; // long visits get their own day
      const d = haversineKm(last, c);
      if (d > 20) continue;
      if (c.best === 'Evening') {
        if (evening || c.dur > 240) continue;
      } else {
        const leg = makeLeg(last, c, city, c)?.mins ?? 0;
        if (total + leg + c.dur > DAY_BUDGET_MIN) continue;
      }
      if (d < bestKm) {
        best = c;
        bestKm = d;
      }
    }
    if (!best) break;
    used.add(best.id);
    visits.push(best);
    if (best.best === 'Evening') evening = best;
    else {
      total += (makeLeg(last, best, city, best)?.mins ?? 0) + best.dur;
      last = best;
    }
  }
  return visits;
}

/** Plan up to MAX_TRIP_DAYS days around an anchor place. Returns [{city, visits, dayTrip}] */
function planTrip(anchor, ctx) {
  const homeCity = ctx.cities.get(anchor.city);
  const used = new Set();
  const days = [];
  const sameCity = ctx.placesByCity.get(anchor.city) ?? [];

  days.push({ city: homeCity, visits: buildDay(anchor, sameCity, used, homeCity, anchor.months), dayTrip: false });

  let dayTrips = 0;
  while (days.length < MAX_TRIP_DAYS) {
    const remaining = sameCity
      .filter((p) => !used.has(p.id) && monthsOverlap(p.months, anchor.months))
      .sort((a, b) => b.pop - a.pop);
    if (remaining.length) {
      days.push({ city: homeCity, visits: buildDay(remaining[0], sameCity, used, homeCity, anchor.months), dayTrip: false });
      continue;
    }
    if (dayTrips >= MAX_DAY_TRIPS) break;
    let planned = false;
    for (const near of homeCity.nearby) {
      const nearCity = ctx.cities.get(near.id);
      const pool = (ctx.placesByCity.get(near.id) ?? [])
        .filter((p) => !used.has(p.id) && monthsOverlap(p.months, anchor.months))
        .sort((a, b) => b.pop - a.pop);
      if (!pool.length) continue;
      days.push({ city: nearCity, visits: buildDay(pool[0], pool, used, nearCity, anchor.months), dayTrip: true });
      dayTrips += 1;
      planned = true;
      break;
    }
    if (!planned) break;
  }
  return days;
}

function visitStop(v, time, duration, titleSuffix = '') {
  return {
    time: hhmm(time),
    end_time: hhmm(time + duration),
    title: `${v.name}${titleSuffix}`,
    type: visitType(v.tags),
    place_id: v.id,
    duration_mins: duration,
    cost_eur: titleSuffix ? 0 : v.cost,
    indoor: v.indoor,
    lat: v.lat,
    lon: v.lon,
    notes: titleSuffix ? 'Continue exploring at your own pace.' : v.tip,
  };
}

function genericStop(type, title, time, duration, cost, notes, at) {
  return {
    time: hhmm(time),
    end_time: hhmm(time + duration),
    title,
    type,
    duration_mins: duration,
    cost_eur: cost,
    indoor: type === 'food',
    ...(at ? { lat: at.lat, lon: at.lon } : {}),
    notes,
  };
}

const NORTHERN_ZONES = new Set(['north', 'lapland', 'arctic']);

/** Turn a day's visits into a timed schedule + route. */
function scheduleDay(day, dayNumber, homeCity, seedTheme) {
  const { city, visits, dayTrip } = day;
  const daytime = visits.filter((v) => v.best !== 'Evening');
  const evening = visits.filter((v) => v.best === 'Evening');
  const stops = [];
  const legs = [];
  const waypoints = [{ name: homeCity.hub.name, lat: homeCity.hub.lat, lon: homeCity.hub.lon, kind: 'start' }];
  let t = DAY_START_MIN;
  let pos = homeCity.hub;
  let lunch = false;
  let coffee = false;

  const addLeg = (to, target, label) => {
    const leg = makeLeg(pos, to, dayTrip ? homeCity : city, target);
    if (!leg) return;
    legs.push(leg);
    stops.push(genericStop('transport', `${leg.verb} to ${label}`, t, leg.mins, leg.cost, leg.notes));
    t += leg.mins;
  };
  const addLunch = (near, duration = 60, picnic = false) => {
    const title = picnic ? `Picnic or café lunch at ${near.name}` : `Lunch near ${near.name}`;
    const notes = picnic
      ? 'Pack a picnic or use the on-site café; many trails have campfire sites.'
      : 'Look for a weekday “lounas” lunch buffet — usually €12–16 including salad, bread and coffee.';
    stops.push(genericStop('food', title, t, duration, picnic ? 10 : 15, notes, near));
    t += duration;
    lunch = true;
  };

  daytime.forEach((v, i) => {
    addLeg(v, v, v.name);
    if (!lunch && t >= 11 * 60 + 45) addLunch(pos === homeCity.hub ? v : pos);
    waypoints.push({ name: v.name, lat: v.lat, lon: v.lon, kind: 'stop', place_id: v.id });
    const spansLunch = !lunch && t < 12 * 60 && t + v.dur > 12 * 60 + 30 && v.dur >= 180;
    if (spansLunch && 12 * 60 - t >= 60) {
      const first = Math.round((12 * 60 - t) / 5) * 5;
      stops.push(visitStop(v, t, first));
      t += first;
      addLunch(v, 45, !v.indoor);
      stops.push(visitStop(v, t, v.dur - first, ' (continued)'));
      t += v.dur - first;
    } else {
      stops.push(visitStop(v, t, v.dur));
      t += v.dur;
    }
    pos = v;
    const more = i < daytime.length - 1;
    if (lunch && !coffee && more && t >= 14 * 60 + 15 && t <= 16 * 60 + 30) {
      stops.push(genericStop('food', 'Kahvi & pulla break', t, 30, 6, 'Finnish coffee break with a cardamom bun (pulla) — a daily ritual.', v));
      t += 30;
      coffee = true;
    }
  });

  if (!lunch) {
    t = Math.max(t, 12 * 60);
    addLunch(pos === homeCity.hub ? (daytime[0] ?? homeCity.hub) : pos);
  }

  if (!dayTrip && t < 15 * 60) {
    const free = 16 * 60 - t;
    stops.push(
      genericStop('leisure', `Free time in ${city.city}`, t, free, 0, `Wander the centre, browse local shops or relax at a café in ${city.city}.`),
    );
    t += free;
  }

  if (dayTrip) {
    const leg = makeLeg(pos, homeCity.hub, homeCity, null);
    if (leg) {
      legs.push(leg);
      stops.push(genericStop('transport', `Return to ${homeCity.city}`, t, leg.mins, leg.cost, leg.notes));
      t += leg.mins;
    }
    pos = homeCity.hub;
    waypoints.push({ name: homeCity.hub.name, lat: homeCity.hub.lat, lon: homeCity.hub.lon, kind: 'end' });
  }

  // Dinner (and optional evening activity)
  const dinnerNotes = NORTHERN_ZONES.has(homeCity.zone)
    ? `Local specialty: ${homeCity.specialty}. From September to March, look up after 21:00 — northern lights are possible on clear nights.`
    : `Local specialty: ${homeCity.specialty}. Reserve ahead on Friday and Saturday evenings.`;
  const eventStartFor = (v) => (v.tags.includes('aurora') ? 21 * 60 : v.tags.includes('music') ? 19 * 60 : 19 * 60 + 30);

  if (evening.length) {
    const ev = evening[0];
    const legToEv = makeLeg(pos, ev, homeCity, ev);
    let evStart = Math.max(eventStartFor(ev), t + 30 + (legToEv?.mins ?? 0));
    const dinnerAt = Math.max(t + 15, Math.min(18 * 60, evStart - (legToEv?.mins ?? 0) - 90));
    t = ceil5(dinnerAt);
    stops.push(genericStop('food', `Dinner: ${homeCity.specialty}`, t, 75, 30, dinnerNotes));
    t += 75;
    evStart = Math.max(evStart, t + (legToEv?.mins ?? 0));
    if (legToEv) {
      t = evStart - legToEv.mins;
      addLeg(ev, ev, ev.name);
    }
    t = evStart;
    waypoints.push({ name: ev.name, lat: ev.lat, lon: ev.lon, kind: 'stop', place_id: ev.id });
    stops.push(visitStop(ev, t, ev.dur));
    t += ev.dur;
  } else {
    t = ceil5(Math.max(t + 15, 18 * 60 + 30));
    stops.push(genericStop('food', `Dinner: ${homeCity.specialty}`, t, 90, 30, dinnerNotes));
  }

  const totalKm = round1(legs.reduce((s, l) => s + l.km, 0));
  const mode = summarizeModes(legs.map((l) => l.mode));
  const names = visits.map((v) => v.name);
  const via = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
  const outdoorMins = visits.filter((v) => !v.indoor).reduce((s, v) => s + v.dur, 0);
  const allMins = visits.reduce((s, v) => s + v.dur, 0) || 1;
  const outdoorShare = outdoorMins / allMins;

  const phrase = themeFor(visits);
  const theme = seedTheme ?? (dayTrip ? `Day Trip to ${city.city}: ${phrase}` : `${phrase} in ${city.city}`);

  return {
    day: dayNumber,
    theme,
    area: city.city,
    destination_id: city.id,
    is_day_trip: dayTrip,
    weather_sensitivity: outdoorShare > 0.6 ? 'outdoor' : outdoorShare < 0.3 ? 'indoor' : 'mixed',
    day_cost_eur: round1(stops.reduce((s, x) => s + (x.cost_eur ?? 0), 0)),
    route: {
      transport_mode: mode,
      total_distance_km: totalKm,
      route_summary: `${mode} (${totalKm} km) via ${via}.`,
      waypoints,
    },
    stops,
  };
}

// ---------------------------------------------------------------- main
async function main() {
  const seed = JSON.parse(await readFile(SEED_PATH, 'utf8'));
  const cache = await loadCache();

  // ---- destinations
  const catalogCities = new Map(CITIES.map((c) => [c.id, c]));
  const cities = new Map();
  for (const d of seed.destinations) {
    const cat = catalogCities.get(d.id);
    cities.set(d.id, {
      id: d.id,
      city: d.city,
      region: d.region,
      lat: d.coordinates.lat,
      lon: d.coordinates.lon,
      hub: cat?.hub ?? { name: `${d.city} Centre`, lat: d.coordinates.lat, lon: d.coordinates.lon },
      zone: cat?.zone ?? SEED_ZONE_OVERRIDES[d.id] ?? 'south',
      tram: cat?.tram ?? false,
      specialty: cat?.specialty ?? 'seasonal Nordic dishes',
      wiki: cat?.wiki ?? d.city,
      description: cat?.description ?? '',
      seedImage: d.image_url,
      seedImageAlt: d.image_alt,
    });
  }
  for (const c of CITIES) {
    if (!cities.has(c.id)) cities.set(c.id, { ...c, seedImage: null, seedImageAlt: null });
  }
  for (const c of cities.values()) {
    c.nearby = [...cities.values()]
      .filter((o) => o.id !== c.id)
      .map((o) => ({ id: o.id, distance_km: Math.round(haversineKm(c, o)) }))
      .filter((o) => o.distance_km <= NEARBY_CITY_KM)
      .sort((a, b) => a.distance_km - b.distance_km);
  }

  // ---- places (seed first, then catalogue)
  const seedPlaceById = new Map();
  const places = [];
  for (const d of seed.destinations) {
    for (const sp of d.places) {
      const o = SEED_OVERRIDES[sp.id] ?? {};
      seedPlaceById.set(sp.id, sp);
      const tags = [...new Set([...sp.tags, ...(SEED_EXTRA_TAGS[sp.id] ?? [])])];
      places.push({
        city: d.id,
        id: sp.id,
        name: sp.name,
        wiki: o.wiki === undefined ? null : o.wiki,
        lat: sp.coordinates.lat,
        lon: sp.coordinates.lon,
        price: sp.price_range,
        cost: sp.estimated_cost_eur,
        pop: sp.popularity_score,
        popular: sp.popular,
        tags,
        dur: o.dur ?? Math.max(60, sp.seed_stops.reduce((s, x) => s + (x.type === 'transport' ? 0 : x.duration_mins), 0)),
        best: sp.best_time_of_day,
        summary: sp.summary,
        tip: o.tip ?? sp.seed_stops.find((s) => s.type !== 'transport')?.notes ?? '',
        months: o.months ?? null,
        access: o.access ?? null,
        seed: sp,
      });
    }
  }
  const seen = new Set(places.map((p) => p.id));
  for (const cp of [...PLACES_SOUTH, ...PLACES_CENTRAL, ...PLACES_NORTH]) {
    if (seen.has(cp.id)) throw new Error(`Duplicate place id: ${cp.id}`);
    if (!cities.has(cp.city)) throw new Error(`Unknown city "${cp.city}" for ${cp.id}`);
    seen.add(cp.id);
    places.push({ ...cp, popular: cp.pop >= 85, seed: null });
  }

  // ---- Wikipedia enrichment
  const lookups = [...[...cities.values()].map((c) => c.wiki), ...places.map((p) => p.wiki)].filter(Boolean);
  const pending = lookups.filter((t) => !(t in cache));
  if (pending.length) console.log(`Resolving ${pending.length} Wikipedia pages${OFFLINE ? ' (offline: skipped)' : ''}…`);
  let n = 0;
  for (const t of lookups) {
    const wasCached = t in cache;
    await fetchWikiSummary(t, cache);
    if (!wasCached && ++n % 25 === 0) console.log(`  …${n}/${pending.length}`);
  }

  let coordFixes = 0;
  for (const p of places) {
    const w = p.wiki ? cache[p.wiki] : null;
    p.wikiInfo = w;
    if (w?.lat != null) {
      const d = haversineKm(p, { lat: w.lat, lon: w.lon });
      if (d > 100) {
        // almost certainly the wrong article (e.g. a namesake elsewhere) — don't trust its photo either
        console.warn(`  ! ${p.id}: Wikipedia page "${p.wiki}" is ${Math.round(d)} km away — ignoring it`);
        p.wikiInfo = null;
      } else if (p.seed) {
        // seed coordinates are authoritative
      } else if (d > 0.3 && d <= 25) {
        p.lat = round5(w.lat);
        p.lon = round5(w.lon);
        coordFixes++;
      } else if (d > 25) {
        console.warn(`  ! ${p.id}: Wikipedia coordinates are ${Math.round(d)} km away — keeping curated coordinates`);
      }
    }
    p.indoor = isIndoor(p.tags);
  }
  console.log(`Adjusted ${coordFixes} place coordinates using Wikipedia.`);

  // ---- images: seed photo → Wikipedia article photo → Commons search, always as thumbnails
  const imageSources = { override: 0, seed: 0, wikipedia: 0, commons: 0, none: 0 };
  for (const p of places) {
    const cityName = cities.get(p.city).city;
    let img = null;
    if (p.id in IMAGE_OVERRIDES) {
      const file = IMAGE_OVERRIDES[p.id];
      img = file ? await resolveImage(`https://commons.wikimedia.org/wiki/File:${file.replace(/ /g, '_')}`, cache) : null;
      if (file && !img) console.warn(`  ! image override for ${p.id} not found on Commons: ${file}`);
      if (img) imageSources.override++;
      else imageSources.none++;
      p.img = img;
      continue;
    }
    if (p.seed?.image_url) {
      img = await resolveImage(p.seed.image_url, cache);
      if (img) imageSources.seed++;
      else console.warn(`  ! seed image for ${p.id} no longer exists, falling back`);
    }
    if (!img && p.wikiInfo?.image) {
      img = await resolveImage(p.wikiInfo.image, cache);
      if (img) imageSources.wikipedia++;
    }
    if (!img) {
      const hit = await findCommonsPhoto(p, cityName, cache);
      if (hit) {
        img = { image: wikimediaThumb(hit.url, hit.width, 1280), thumb: wikimediaThumb(hit.url, hit.width, 500) };
        imageSources.commons++;
      }
    }
    if (!img) imageSources.none++;
    p.img = img;
  }
  console.log(
    `Images: ${imageSources.override} hand-picked, ${imageSources.seed} seed, ${imageSources.wikipedia} Wikipedia, ${imageSources.commons} Commons search, ${imageSources.none} none.`,
  );

  // stop / fallback-plan photos in the seed
  const stopImages = new Map();
  for (const p of places) {
    for (const u of [...(p.seed?.seed_stops ?? []).map((s) => s.image_url), p.seed?.fallback_plan?.image_url]) {
      if (u && !stopImages.has(u)) stopImages.set(u, (await resolveImage(u, cache, { large: 960 }))?.image ?? null);
    }
  }

  // city photos
  for (const c of cities.values()) {
    c.img = (await resolveImage(c.seedImage, cache, { large: 1600, small: 500 })) ?? (await resolveImage(cache[c.wiki]?.image, cache));
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_PATH, JSON.stringify(cache, null, 1));

  // ---- itineraries
  const placesByCity = new Map();
  for (const p of places) {
    if (!placesByCity.has(p.city)) placesByCity.set(p.city, []);
    placesByCity.get(p.city).push(p);
  }
  const ctx = { cities, placesByCity };

  const outPlaces = new Map(); // city -> []
  for (const p of places) {
    const city = cities.get(p.city);
    const planned = planTrip(p, ctx);
    const days = planned.map((d, i) =>
      scheduleDay(d, i + 1, city, i === 0 && p.seed ? p.seed.fallback_plan?.theme : undefined),
    );
    const recommended = days.map((_, i) => i + 1);
    const day1 = days[0];
    const image = p.img?.image ?? null;
    const thumb = p.img?.thumb ?? null;

    const record = {
      id: p.id,
      name: p.name,
      city: city.city,
      destination_id: city.id,
      region: city.region,
      image_url: image,
      image_thumb_url: thumb,
      image_alt: p.seed?.image_alt ?? `${p.name}, ${city.city}`,
      image_credit: image ? 'Wikimedia Commons' : null,
      wikipedia_url: p.wikiInfo?.url ?? null,
      popular: p.popular,
      popularity_score: p.pop,
      price_range: p.price,
      estimated_cost_eur: p.cost,
      recommended_days: recommended,
      tags: p.tags,
      indoor: p.indoor,
      coordinates: { lat: p.lat, lon: p.lon },
      summary: p.summary,
      tip: p.tip,
      best_time_of_day: p.best,
      duration_mins: p.dur,
      open_months: p.months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      season_label: seasonLabel(p.months),
      access: p.access ?? 'city',
      seed_stops: p.seed?.seed_stops?.map((s) => ({ ...s, image_url: s.image_url ? stopImages.get(s.image_url) ?? null : null })) ?? [
        ...(day1.stops.find((s) => s.type === 'transport')
          ? [(({ title, type, duration_mins, cost_eur, notes }) => ({ title, type, duration_mins, cost_eur, image_url: null, image_alt: null, notes }))(day1.stops.find((s) => s.type === 'transport'))]
          : []),
        { title: p.name, type: visitType(p.tags), duration_mins: p.dur, cost_eur: p.cost, image_url: null, image_alt: null, notes: p.tip },
      ],
      seed_route: p.seed?.seed_route ?? {
        transport_mode: day1.route.transport_mode,
        total_distance_km: day1.route.total_distance_km,
        waypoints: day1.route.waypoints.map(({ name, lat, lon }) => ({ name, lat, lon, image_url: null })),
      },
      fallback_plan: p.seed?.fallback_plan
        ? { ...p.seed.fallback_plan, image_url: p.seed.fallback_plan.image_url ? stopImages.get(p.seed.fallback_plan.image_url) ?? null : null }
        : {
            day: 1,
            theme: day1.theme,
            image_url: thumb,
            image_alt: `${p.name}, ${city.city}`,
            route_summary: day1.route.route_summary,
            stops: day1.stops.map(({ time, title, type, cost_eur, notes }) => ({ time, title, type, cost_eur, notes })),
          },
      itinerary: {
        max_days: days.length,
        note: 'A trip of N days uses the first N days of this plan.',
        total_cost_eur: round1(days.reduce((s, d) => s + d.day_cost_eur, 0)),
        days,
      },
    };
    if (!outPlaces.has(city.id)) outPlaces.set(city.id, []);
    outPlaces.get(city.id).push(record);
  }

  // ---- assemble destinations
  const destinations = [];
  for (const c of cities.values()) {
    const ps = (outPlaces.get(c.id) ?? []).sort((a, b) => b.popularity_score - a.popularity_score);
    if (!ps.length) continue;
    const zone = CLIMATE_ZONES[c.zone];
    const w = cache[c.wiki];
    const image = c.img?.image ?? ps.find((p) => p.image_url)?.image_url ?? null;
    const thumb = c.img?.thumb ?? ps.find((p) => p.image_thumb_url)?.image_thumb_url ?? null;
    const tagCounts = new Map();
    ps.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
    destinations.push({
      id: c.id,
      city: c.city,
      region: c.region,
      country: 'Finland',
      description: c.description,
      image_url: image,
      image_thumb_url: thumb,
      image_alt: c.seedImageAlt ?? `${c.city}, Finland`,
      wikipedia_url: w?.url ?? null,
      coordinates: { lat: c.lat, lon: c.lon },
      hub: c.hub,
      currency: 'EUR',
      has_tram: c.tram,
      local_specialty: c.specialty,
      climate_zone: c.zone,
      aurora_zone: ['north', 'lapland', 'arctic'].includes(c.zone),
      climate: {
        source: 'Approximate 1991–2020 climate normals',
        monthly: zone.high.map((hi, i) => ({
          month: i + 1,
          avg_high_c: hi,
          avg_low_c: zone.low[i],
          precip_mm: zone.precip[i],
          daylight_hours: daylightHours(c.lat, i + 1),
        })),
      },
      nearby_destinations: c.nearby,
      top_tags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t),
      place_count: ps.length,
      places: ps,
    });
  }
  destinations.sort((a, b) => b.place_count - a.place_count || a.city.localeCompare(b.city));

  const allPlaces = destinations.flatMap((d) => d.places);
  const tagCounts = new Map();
  allPlaces.forEach((p) => p.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));

  const out = {
    country: 'Finland',
    country_code: 'FI',
    default_currency: 'EUR',
    schema_version: '3.0',
    generated_at: new Date().toISOString(),
    attribution: {
      images: 'Photos from Wikimedia Commons (via the Wikipedia REST API) and Unsplash; see each image page for license.',
      weather: 'Live forecasts from Open-Meteo.com (CC BY 4.0) at runtime; climate normals are approximate.',
      disclaimer: 'Prices, opening seasons and durations are estimates for planning — always confirm with the venue.',
    },
    stats: {
      destinations: destinations.length,
      places: allPlaces.length,
      itinerary_days: allPlaces.reduce((s, p) => s + p.itinerary.days.length, 0),
      stops: allPlaces.reduce((s, p) => s + p.itinerary.days.reduce((x, d) => x + d.stops.length, 0), 0),
    },
    price_ranges: [
      { id: 'free', label: 'Free', description: 'No entry fee' },
      { id: 'budget', label: 'Budget', description: 'Up to €15' },
      { id: 'mid', label: 'Mid-range', description: '€15–35' },
      { id: 'high', label: 'Premium', description: '€35+' },
    ],
    tags_catalog: [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id, count]) => ({ id, label: tagLabel(id), count })),
    destinations,
  };

  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  const json = JSON.stringify(out, null, 2);
  await writeFile(OUT_PATH, json);
  const withImages = allPlaces.filter((p) => p.image_url).length;
  console.log(
    `Wrote ${path.relative(ROOT, OUT_PATH)}: ${out.stats.destinations} destinations, ${out.stats.places} places ` +
      `(${withImages} with photos), ${out.stats.itinerary_days} itinerary days, ${out.stats.stops} stops, ` +
      `${(json.length / 1024 / 1024).toFixed(2)} MB`,
  );
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
