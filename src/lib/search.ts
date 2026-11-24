import type { Destination, Filters, Place } from '../types';
import { monthOf } from './dates';
import { PRICE_ORDER } from './format';
import { normalize } from './text';

export interface ScoredPlace {
  place: Place;
  score: number;
}

/** Text relevance for free-text queries. 0 = no match. */
export function textScore(place: Place, query: string): number {
  const q = normalize(query);
  if (!q) return 1;
  const terms = q.split(/\s+/).filter(Boolean);
  let total = 0;
  for (const term of terms) {
    const name = normalize(place.name);
    const city = normalize(place.city);
    let s = 0;
    if (city === term || city.startsWith(term)) s = Math.max(s, 6);
    if (name.startsWith(term)) s = Math.max(s, 5);
    else if (name.includes(term)) s = Math.max(s, 4);
    if (normalize(place.region).includes(term)) s = Math.max(s, 3);
    if (place.tags.some((t) => normalize(t).startsWith(term))) s = Math.max(s, 3);
    if (normalize(place.summary).includes(term)) s = Math.max(s, 1);
    if (s === 0) return 0; // every term must match something
    total += s;
  }
  return total;
}

export function isInSeason(place: Place, isoDate: string): boolean {
  return place.open_months.includes(monthOf(isoDate));
}

export function filterPlaces(places: Place[], f: Filters): ScoredPlace[] {
  const result: ScoredPlace[] = [];
  for (const place of places) {
    if (f.city && place.destination_id !== f.city) continue;
    if (f.popular && !place.popular) continue;
    if (f.price.length && !f.price.includes(place.price_range)) continue;
    if (f.days && !place.recommended_days.includes(f.days)) continue;
    if (f.tags.length) {
      const hits = f.tags.filter((t) => place.tags.includes(t)).length;
      if (f.tagMode === 'all' ? hits < f.tags.length : hits === 0) continue;
    }
    if (f.inSeason && f.date && !isInSeason(place, f.date)) continue;
    const score = textScore(place, f.q);
    if (score === 0) continue;
    const tagBoost = f.tags.filter((t) => place.tags.includes(t)).length;
    result.push({ place, score: score + tagBoost });
  }
  return sortPlaces(result, f.q && f.sort === 'popular' ? 'relevance' : f.sort);
}

export function sortPlaces(items: ScoredPlace[], sort: Filters['sort']): ScoredPlace[] {
  const sorted = [...items];
  const byPop = (a: ScoredPlace, b: ScoredPlace) => b.place.popularity_score - a.place.popularity_score;
  switch (sort) {
    case 'relevance':
      return sorted.sort((a, b) => b.score - a.score || byPop(a, b));
    case 'price-asc':
      return sorted.sort(
        (a, b) => PRICE_ORDER[a.place.price_range] - PRICE_ORDER[b.place.price_range] || a.place.estimated_cost_eur - b.place.estimated_cost_eur || byPop(a, b),
      );
    case 'price-desc':
      return sorted.sort(
        (a, b) => PRICE_ORDER[b.place.price_range] - PRICE_ORDER[a.place.price_range] || b.place.estimated_cost_eur - a.place.estimated_cost_eur || byPop(a, b),
      );
    case 'name':
      return sorted.sort((a, b) => a.place.name.localeCompare(b.place.name, 'fi'));
    case 'popular':
    default:
      return sorted.sort(byPop);
  }
}

export interface Suggestion {
  kind: 'city' | 'place';
  id: string;
  label: string;
  sublabel: string;
}

export function suggest(destinations: Destination[], places: Place[], query: string, limit = 8): Suggestion[] {
  const q = normalize(query);
  if (!q) return [];
  const cities = destinations
    .filter((d) => normalize(d.city).includes(q) || normalize(d.region).includes(q))
    .sort((a, b) => Number(normalize(b.city).startsWith(q)) - Number(normalize(a.city).startsWith(q)) || b.place_count - a.place_count)
    .slice(0, 5)
    .map<Suggestion>((d) => ({ kind: 'city', id: d.id, label: d.city, sublabel: `${d.region} · ${d.place_count} places` }));
  const placeHits = places
    .filter((p) => normalize(p.name).includes(q))
    .sort((a, b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)) || b.popularity_score - a.popularity_score)
    .slice(0, limit - cities.length)
    .map<Suggestion>((p) => ({ kind: 'place', id: p.id, label: p.name, sublabel: p.city }));
  return [...cities, ...placeHits];
}
