import { describe, expect, it } from 'vitest';
import { parseSmartQuery } from './smartQuery';
import { makeDestination } from '../test/fixtures';

const destinations = [
  makeDestination(),
  makeDestination({ id: 'turku', city: 'Turku' }),
  makeDestination({ id: 'jyvaskyla', city: 'Jyväskylä' }),
  makeDestination({ id: 'kuusamo', city: 'Kuusamo & Ruka' }),
];
const tags = ['museum', 'history', 'nature', 'hiking', 'family', 'aurora', 'sauna', 'beach'].map((id) => ({ id, label: id, count: 1 }));

describe('parseSmartQuery', () => {
  it('extracts city, tags, price and days', () => {
    const r = parseSmartQuery('free museums in Turku for 2 days', destinations, tags);
    expect(r.city).toBe('turku');
    expect(r.tags).toEqual(['museum']);
    expect(r.price).toEqual(['free']);
    expect(r.days).toBe(2);
    expect(r.rest).toBe('');
  });

  it('handles diacritics, word numbers and synonyms', () => {
    const r = parseSmartQuery('three day hiking trip near jyvaskyla with kids', destinations, tags);
    expect(r.city).toBe('jyvaskyla');
    expect(r.days).toBe(3);
    expect(r.tags.sort()).toEqual(['family', 'hiking']);
  });

  it('maps budget words and price limits', () => {
    expect(parseSmartQuery('cheap things to do', destinations, tags).price.sort()).toEqual(['budget', 'free']);
    expect(parseSmartQuery('under 20 euros', destinations, tags).price.sort()).toEqual(['budget', 'free', 'mid']);
  });

  it('understands weekend, popular and multi-word city names', () => {
    const r = parseSmartQuery('top northern lights weekend in Kuusamo', destinations, tags);
    expect(r.days).toBe(2);
    expect(r.popular).toBe(true);
    expect(r.city).toBe('kuusamo');
    expect(r.tags).toContain('aurora');
  });

  it('caps trip length and keeps unknown words as free text', () => {
    const r = parseSmartQuery('10 days of reindeer', destinations, tags);
    expect(r.days).toBe(5);
    expect(r.rest).toContain('reindeer');
  });
});
