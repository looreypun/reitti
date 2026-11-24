import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildIndex, validateDataset } from '../data/DataProvider';

// Integrity checks on the generated public/data.json
const raw = JSON.parse(readFileSync(resolve(__dirname, '../../public/data.json'), 'utf8'));
const data = buildIndex(validateDataset(raw));

describe('public/data.json', () => {
  it('has many destinations and places', () => {
    expect(data.destinations.length).toBeGreaterThanOrEqual(30);
    expect(data.places.length).toBeGreaterThanOrEqual(200);
  });

  it('has unique place ids', () => {
    expect(new Set(data.places.map((p) => p.id)).size).toBe(data.places.length);
  });

  it('keeps every place inside Finland', () => {
    for (const p of data.places) {
      expect(p.coordinates.lat, p.id).toBeGreaterThan(59.4);
      expect(p.coordinates.lat, p.id).toBeLessThan(70.2);
      expect(p.coordinates.lon, p.id).toBeGreaterThan(19.0);
      expect(p.coordinates.lon, p.id).toBeLessThan(31.7);
    }
  });

  it('has a consistent itinerary for every recommended trip length', () => {
    for (const p of data.places) {
      expect(p.recommended_days, p.id).toEqual(p.itinerary.days.map((_, i) => i + 1));
      expect(p.itinerary.max_days).toBe(p.itinerary.days.length);
      expect(p.itinerary.days[0].stops.some((s) => s.place_id === p.id), `${p.id} day 1 includes the place`).toBe(true);
      for (const d of p.itinerary.days) {
        expect(d.route.waypoints.length, `${p.id} day ${d.day}`).toBeGreaterThan(0);
        const times = d.stops.map((s) => s.time);
        expect([...times].sort(), `${p.id} day ${d.day} chronological`).toEqual(times);
      }
    }
  });

  it('only uses known tags and price ranges', () => {
    const tags = new Set(data.dataset.tags_catalog.map((t) => t.id));
    const prices = new Set(data.dataset.price_ranges.map((r) => r.id));
    for (const p of data.places) {
      p.tags.forEach((t) => expect(tags.has(t)).toBe(true));
      expect(prices.has(p.price_range)).toBe(true);
    }
  });

  it('has 12 months of climate data per destination', () => {
    for (const d of data.destinations) expect(d.climate.monthly).toHaveLength(12);
  });
});
