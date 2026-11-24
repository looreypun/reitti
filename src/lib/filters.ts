import type { Filters, PriceRange, SortKey } from '../types';
import { isValidISODate, todayISO } from './dates';

const PRICES: PriceRange[] = ['free', 'budget', 'mid', 'high'];
const SORTS: SortKey[] = ['popular', 'price-asc', 'price-desc', 'name', 'relevance'];
export const MAX_TRIP_DAYS = 5;

export function defaultFilters(): Filters {
  return {
    q: '',
    city: null,
    popular: false,
    price: [],
    days: null,
    tags: [],
    tagMode: 'any',
    date: todayISO(),
    inSeason: false,
    sort: 'popular',
  };
}

const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Parse filters from URL search params, ignoring anything invalid. */
export function filtersFromParams(params: URLSearchParams): Filters {
  const d = defaultFilters();
  const days = Number(params.get('days'));
  const date = params.get('date');
  const sort = params.get('sort') as SortKey | null;
  return {
    q: params.get('q') ?? d.q,
    city: params.get('city') || null,
    popular: params.get('popular') === '1',
    price: list(params.get('price')).filter((p): p is PriceRange => PRICES.includes(p as PriceRange)),
    days: Number.isInteger(days) && days >= 1 && days <= MAX_TRIP_DAYS ? days : null,
    tags: list(params.get('tags')),
    tagMode: params.get('match') === 'all' ? 'all' : 'any',
    date: isValidISODate(date) && date >= todayISO() ? date : d.date,
    inSeason: params.get('season') === '1',
    sort: sort && SORTS.includes(sort) ? sort : d.sort,
  };
}

/** Serialize only non-default values to keep URLs short and shareable. */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.city) p.set('city', f.city);
  if (f.popular) p.set('popular', '1');
  if (f.price.length) p.set('price', f.price.join(','));
  if (f.days) p.set('days', String(f.days));
  if (f.tags.length) p.set('tags', f.tags.join(','));
  if (f.tagMode === 'all') p.set('match', 'all');
  if (f.date !== todayISO()) p.set('date', f.date);
  if (f.inSeason) p.set('season', '1');
  if (f.sort !== 'popular') p.set('sort', f.sort);
  return p;
}

export function activeFilterCount(f: Filters): number {
  return (
    (f.city ? 1 : 0) +
    (f.popular ? 1 : 0) +
    f.price.length +
    (f.days ? 1 : 0) +
    f.tags.length +
    (f.inSeason ? 1 : 0)
  );
}
