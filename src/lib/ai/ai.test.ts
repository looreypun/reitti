import { describe, expect, it } from 'vitest';
import { makeDestination, makePlace } from '../../test/fixtures';
import { buildContext, MAX_CONTEXT_PLACES, retrievePlaces } from './context';
import { citedPlaceIds, parseAnswer, stripThinking } from './answer';

const destinations = [makeDestination(), makeDestination({ id: 'turku', city: 'Turku', region: 'Southwest Finland' })];
const places = [
  makePlace({ id: 'suomenlinna', name: 'Suomenlinna', tags: ['history', 'unesco'], popularity_score: 98 }),
  makePlace({ id: 'ateneum', name: 'Ateneum', tags: ['museum', 'art'], indoor: true, price_range: 'mid', estimated_cost_eur: 22, popularity_score: 91 }),
  makePlace({ id: 'turku-castle', name: 'Turku Castle', city: 'Turku', destination_id: 'turku', tags: ['castle', 'history', 'museum'], indoor: true, popularity_score: 90 }),
  makePlace({ id: 'ruissalo', name: 'Ruissalo', city: 'Turku', destination_id: 'turku', tags: ['nature', 'island'], popularity_score: 70 }),
];
const tagCatalog = ['history', 'unesco', 'museum', 'art', 'castle', 'nature', 'island'].map((id) => ({ id, label: id, count: 1 }));
const base = { destinations, places, tagCatalog, previousQuestions: [] as string[], today: '2026-11-24' };

describe('AI retrieval', () => {
  it('restricts to the city in the question and ranks by interest', () => {
    const r = retrievePlaces({ ...base, question: 'any castles in Turku?' });
    expect(r.places.map((p) => p.id)).toEqual(['turku-castle', 'ruissalo']);
    expect(r.destinations.map((d) => d.id)).toEqual(['turku']);
  });

  it('carries the city over to a follow-up question', () => {
    const r = retrievePlaces({ ...base, question: 'what about nature?', previousQuestions: ['museums in Turku'] });
    expect(r.places[0].id).toBe('ruissalo');
    expect(r.places.every((p) => p.destination_id === 'turku')).toBe(true);
  });

  it('reads a short follow-up together with the previous question', () => {
    const r = retrievePlaces({ ...base, question: 'what about cheaper ones?', previousQuestions: ['rainy day in Helsinki'] });
    expect(r.places.map((p) => p.id)).toEqual(['suomenlinna']);
  });

  it('leaves out unrelated filler when something matches', () => {
    const r = retrievePlaces({ ...base, question: 'castles please' });
    expect(r.places.map((p) => p.id)).toEqual(['turku-castle']);
  });

  it('prefers indoor places for rainy days and honours price words', () => {
    expect(retrievePlaces({ ...base, question: 'rainy day in Helsinki' }).places[0].id).toBe('ateneum');
    expect(retrievePlaces({ ...base, question: 'free things in Helsinki' }).places.map((p) => p.id)).toEqual(['suomenlinna']);
  });

  it('falls back to popular places and caps the context size', () => {
    const many = Array.from({ length: 30 }, (_, i) => makePlace({ id: `p${i}`, popularity_score: i }));
    const r = retrievePlaces({ ...base, places: many, question: 'hello' });
    expect(r.places).toHaveLength(MAX_CONTEXT_PLACES);
    expect(r.places[0].id).toBe('p29');
  });

  it('writes place ids into the context so the model can cite them', () => {
    const { context } = buildContext({ ...base, question: 'Turku castle' });
    expect(context).toContain('[[turku-castle]] Turku Castle — Turku');
    expect(context).toContain('Today: 2026-11-24 (November)');
  });
});

describe('AI answer parsing', () => {
  const known = (id: string) => ['suomenlinna', 'ateneum'].includes(id);

  it('turns bullets, bold and place references into blocks', () => {
    const blocks = parseAnswer('Try these:\n- **Suomenlinna** [[suomenlinna]] is free\n- Ateneum [[ateneum]]', known);
    expect(blocks.map((b) => b.type)).toEqual(['p', 'li', 'li']);
    expect(blocks[1].inlines).toEqual([
      { type: 'bold', text: 'Suomenlinna' },
      { type: 'text', text: ' ' },
      { type: 'place', id: 'suomenlinna' },
      { type: 'text', text: ' is free' },
    ]);
  });

  it('drops unknown or half-streamed references', () => {
    expect(parseAnswer('See Foo [[made-up]] now', known)[0].inlines).toEqual([{ type: 'text', text: 'See Foo now' }]);
    expect(parseAnswer('Visit Ateneum [[aten', known)[0].inlines).toEqual([{ type: 'text', text: 'Visit Ateneum ' }]);
  });

  it('lists cited places once, in order', () => {
    expect(citedPlaceIds('[[ateneum]] then [[suomenlinna]] and [[ateneum]] [[nope]]', known)).toEqual(['ateneum', 'suomenlinna']);
  });

  it('also recognises candidate places mentioned by name only', () => {
    const candidates = [
      { id: 'suomenlinna', name: 'Suomenlinna' },
      { id: 'ateneum', name: 'Ateneum' },
    ];
    expect(citedPlaceIds('Start at ateneum, then Suomenlinna [[suomenlinna]].', known, candidates)).toEqual(['ateneum', 'suomenlinna']);
  });

  it('hides reasoning blocks', () => {
    expect(stripThinking('<think>hmm</think>Hello')).toBe('Hello');
    expect(stripThinking('<think>still thinking')).toBe('');
  });
});
