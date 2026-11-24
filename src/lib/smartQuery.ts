import type { Destination, PriceRange, TagInfo } from '../types';
import { MAX_TRIP_DAYS } from './filters';
import { normalize } from './text';

/**
 * Rule-based query parsing.
 * "free museums in turku for 2 days" → city=turku, tags=[museum], price=[free], days=2.
 */
export interface SmartQueryResult {
  city: string | null;
  tags: string[];
  price: PriceRange[];
  days: number | null;
  popular: boolean;
  inSeason: boolean;
  /** Words that were not understood — used as a free-text search. */
  rest: string;
  /** Human-readable list of what was understood. */
  understood: string[];
}

const TAG_SYNONYMS: Record<string, string[]> = {
  museum: ['museum', 'museums', 'gallery', 'galleries', 'exhibition'],
  history: ['history', 'historic', 'historical', 'heritage', 'old', 'medieval'],
  nature: ['nature', 'natural', 'outdoor', 'outdoors', 'forest', 'forests', 'wilderness'],
  hiking: ['hike', 'hikes', 'hiking', 'trail', 'trails', 'trek', 'trekking'],
  family: ['family', 'kids', 'children', 'child', 'families'],
  art: ['art', 'arts', 'painting', 'paintings'],
  design: ['design'],
  architecture: ['architecture', 'buildings', 'aalto'],
  sauna: ['sauna', 'saunas', 'spa'],
  beach: ['beach', 'beaches', 'swim', 'swimming'],
  winter: ['winter', 'snow', 'christmas'],
  skiing: ['ski', 'skiing', 'slopes'],
  aurora: ['aurora', 'auroras', 'northern', 'lights'],
  castle: ['castle', 'castles', 'fortress', 'fortresses'],
  church: ['church', 'churches', 'cathedral', 'cathedrals'],
  lake: ['lake', 'lakes', 'lakeside'],
  island: ['island', 'islands', 'archipelago'],
  national_park: ['national park', 'national parks', 'park'],
  animals: ['animals', 'animal', 'zoo', 'wildlife', 'reindeer', 'husky', 'huskies'],
  food: ['food', 'market', 'markets', 'eat', 'eating'],
  views: ['view', 'views', 'viewpoint', 'panorama', 'tower'],
  unesco: ['unesco', 'world heritage'],
  science: ['science'],
  music: ['music', 'concert', 'opera', 'jazz'],
  indoor: ['indoor', 'indoors', 'rainy'],
};

const PRICE_WORDS: Record<string, PriceRange[]> = {
  free: ['free'],
  cheap: ['free', 'budget'],
  cheaper: ['free', 'budget'],
  cheapest: ['free', 'budget'],
  budget: ['free', 'budget'],
  affordable: ['free', 'budget'],
  inexpensive: ['free', 'budget'],
  luxury: ['high'],
  expensive: ['high'],
  premium: ['high'],
};

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, a: 1 };
const STOP_WORDS = new Set(['in', 'at', 'near', 'for', 'the', 'a', 'an', 'and', 'with', 'to', 'of', 'trip', 'places', 'place', 'things', 'do', 'what', 'best', 'show', 'me', 'find', 'some', 'visit', 'around', 'finland', 'attractions', 'attraction', 'day', 'days']);

export function parseSmartQuery(input: string, destinations: Destination[], tagCatalog: TagInfo[]): SmartQueryResult {
  let text = ` ${normalize(input).replace(/[^\p{L}\p{N}\s-]/gu, ' ')} `;
  const understood: string[] = [];
  const res: SmartQueryResult = { city: null, tags: [], price: [], days: null, popular: false, inSeason: false, rest: '', understood };
  const consume = (re: RegExp) => {
    text = text.replace(re, ' ');
  };

  // Trip length: "3 days", "three-day", "weekend"
  const daysMatch = text.match(/\b(\d+|one|two|three|four|five|a)[\s-]*(day|days)\b/);
  if (daysMatch) {
    const n = Number(daysMatch[1]) || NUMBER_WORDS[daysMatch[1]] || 0;
    if (n >= 1) {
      res.days = Math.min(n, MAX_TRIP_DAYS);
      understood.push(`${res.days}-day trip`);
    }
    consume(new RegExp(daysMatch[0]));
  } else if (/\bweekend\b/.test(text)) {
    res.days = 2;
    understood.push('2-day trip (weekend)');
    consume(/\bweekend\b/);
  }

  // City: longest matching city name or region (diacritic-insensitive)
  const cityCandidates = [...destinations].sort((a, b) => b.city.length - a.city.length);
  for (const d of cityCandidates) {
    const names = [d.city, d.city.split(/[\s(]/)[0], d.id].map(normalize).filter((n) => n.length >= 3);
    const hit = names.find((n) => new RegExp(`\\b${escapeRe(n)}\\b`).test(text));
    if (hit) {
      res.city = d.id;
      understood.push(d.city);
      consume(new RegExp(`\\b${escapeRe(hit)}\\b`, 'g'));
      break;
    }
  }
  if (!res.city && /\blapland\b/.test(text)) {
    understood.push('Lapland');
    consume(/\blapland\b/);
    // Lapland is a region; handled as free-text region search
    res.rest = 'lapland';
  }

  // Popularity
  if (/\b(popular|top|famous|must[- ]see|best)\b/.test(text)) {
    res.popular = true;
    understood.push('Popular');
    consume(/\b(popular|top|famous|must[- ]see)\b/g);
  }

  // Season
  if (/\b(open now|in season|open)\b/.test(text)) {
    res.inSeason = true;
    understood.push('Open on travel date');
    consume(/\b(open now|in season|open)\b/g);
  }

  // Price
  const priceSet = new Set<PriceRange>();
  for (const [word, ranges] of Object.entries(PRICE_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) {
      ranges.forEach((r) => priceSet.add(r));
      consume(new RegExp(`\\b${word}\\b`, 'g'));
    }
  }
  const underMatch = text.match(/\b(?:under|below|less than|max)\s*(\d+)\s*(?:eur|euro|euros)?\b/);
  if (underMatch) {
    const max = Number(underMatch[1]);
    // include every range whose cheapest option is below the limit
    const lowerBound: Record<PriceRange, number> = { free: 0, budget: 1, mid: 15, high: 35 };
    (Object.keys(lowerBound) as PriceRange[]).filter((r) => lowerBound[r] < max || r === 'free').forEach((r) => priceSet.add(r));
    consume(new RegExp(underMatch[0]));
  }
  if (priceSet.size) {
    res.price = [...priceSet];
    understood.push(`Price: ${res.price.join(', ')}`);
  }

  // Tags (multi-word synonyms first)
  const known = new Set(tagCatalog.map((t) => t.id));
  const entries = Object.entries(TAG_SYNONYMS).flatMap(([tag, words]) => words.map((w) => [tag, w] as const));
  entries.sort((a, b) => b[1].length - a[1].length);
  for (const [tag, word] of entries) {
    if (!known.has(tag)) continue;
    const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'g');
    if (re.test(text)) {
      if (!res.tags.includes(tag)) res.tags.push(tag);
      consume(re);
    }
  }
  if (res.tags.length) {
    const labels = res.tags.map((t) => tagCatalog.find((c) => c.id === t)?.label ?? t);
    understood.push(labels.join(', '));
  }

  const leftover = text
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
  res.rest = [res.rest, ...leftover].filter(Boolean).join(' ');
  return res;
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
