import { describe, expect, it } from 'vitest';
import { filterPlaces, suggest, textScore } from './search';
import { defaultFilters, filtersFromParams, filtersToParams } from './filters';
import { normalize } from './text';
import { makeDestination, makePlace } from '../test/fixtures';

const places = [
  makePlace({ id: 'a', name: 'Suomenlinna', tags: ['history', 'unesco'], price_range: 'budget', popularity_score: 98, recommended_days: [1, 2, 3] }),
  makePlace({ id: 'b', name: 'Ateneum', tags: ['museum', 'art'], price_range: 'mid', popularity_score: 91, popular: true }),
  makePlace({
    id: 'c',
    name: 'Turku Castle',
    city: 'Turku',
    destination_id: 'turku',
    region: 'Southwest Finland',
    tags: ['history', 'museum'],
    price_range: 'mid',
    popularity_score: 80,
    popular: false,
    recommended_days: [1],
  }),
  makePlace({ id: 'd', name: 'Moomin World', tags: ['family'], open_months: [6, 7, 8], popularity_score: 94 }),
];

const f = (patch = {}) => ({ ...defaultFilters(), date: '2026-12-01', ...patch });

describe('normalize', () => {
  it('strips diacritics and lowercases', () => {
    expect(normalize('  Jyväskylä ')).toBe('jyvaskyla');
  });
});

describe('filterPlaces', () => {
  it('filters by city', () => {
    expect(filterPlaces(places, f({ city: 'turku' })).map((r) => r.place.id)).toEqual(['c']);
  });
  it('filters popular only', () => {
    expect(filterPlaces(places, f({ popular: true })).map((r) => r.place.id)).not.toContain('c');
  });
  it('filters by price ranges', () => {
    expect(filterPlaces(places, f({ price: ['mid'] })).map((r) => r.place.id).sort()).toEqual(['b', 'c']);
  });
  it('filters by trip days', () => {
    expect(filterPlaces(places, f({ days: 3 })).map((r) => r.place.id)).toEqual(['a']);
  });
  it('supports any/all tag matching', () => {
    expect(filterPlaces(places, f({ tags: ['history', 'museum'] })).length).toBe(3);
    expect(filterPlaces(places, f({ tags: ['history', 'museum'], tagMode: 'all' })).map((r) => r.place.id)).toEqual(['c']);
  });
  it('hides out-of-season places when requested', () => {
    expect(filterPlaces(places, f({ inSeason: true })).map((r) => r.place.id)).not.toContain('d');
    expect(filterPlaces(places, f({ inSeason: true, date: '2027-07-10' })).map((r) => r.place.id)).toContain('d');
  });
  it('sorts by popularity by default and price ascending on request', () => {
    expect(filterPlaces(places, f()).map((r) => r.place.id)).toEqual(['a', 'd', 'b', 'c']);
    expect(filterPlaces(places, f({ sort: 'price-asc' }))[0].place.id).toBe('d');
  });
  it('matches free text across name, city and tags', () => {
    expect(filterPlaces(places, f({ q: 'turku' })).map((r) => r.place.id)).toEqual(['c']);
    expect(textScore(places[1], 'museum')).toBeGreaterThan(0);
    expect(textScore(places[1], 'zzz')).toBe(0);
  });
});

describe('suggest', () => {
  it('suggests cities before places, diacritic-insensitive', () => {
    const dests = [makeDestination(), makeDestination({ id: 'jyvaskyla', city: 'Jyväskylä', region: 'Central Finland' })];
    const s = suggest(dests, places, 'jyva');
    expect(s[0]).toMatchObject({ kind: 'city', id: 'jyvaskyla' });
  });
});

describe('filters <-> URL params', () => {
  it('round-trips non-default values', () => {
    const original = f({ city: 'helsinki', popular: true, price: ['free', 'budget'], days: 3, tags: ['nature'], tagMode: 'all' as const, date: '2099-01-01' });
    const parsed = filtersFromParams(filtersToParams(original));
    expect(parsed).toEqual(original);
  });
  it('ignores invalid values', () => {
    const parsed = filtersFromParams(new URLSearchParams('days=99&price=cheap,free&date=2020-01-01&sort=bogus'));
    expect(parsed.days).toBeNull();
    expect(parsed.price).toEqual(['free']);
    expect(parsed.sort).toBe('popular');
    expect(parsed.date).toBe(defaultFilters().date);
  });
});
