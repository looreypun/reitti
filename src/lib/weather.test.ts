import { describe, expect, it } from 'vitest';
import { climateDay, describeWeatherCode, inForecastWindow, isWetOrSevere, parseOpenMeteo } from './weather';
import { tipsForDay } from './planner';
import { makeDestination } from '../test/fixtures';
import type { DayPlan } from '../types';

describe('weather codes', () => {
  it('maps WMO codes', () => {
    expect(describeWeatherCode(0).kind).toBe('clear');
    expect(describeWeatherCode(63).kind).toBe('rain');
    expect(describeWeatherCode(73).kind).toBe('snow');
    expect(describeWeatherCode(95).kind).toBe('storm');
  });
});

describe('climate fallback', () => {
  const dest = makeDestination();
  it('uses monthly normals and marks source', () => {
    const w = climateDay('2027-01-15', dest.climate.monthly);
    expect(w.source).toBe('climate');
    expect(w.tMax).toBe(-2);
    expect(describeWeatherCode(w.code).kind).toBe('cloudy');
  });
  it('predicts rain in a wet warm month', () => {
    const w = climateDay('2027-08-10', dest.climate.monthly);
    expect(describeWeatherCode(w.code).kind).toBe('rain');
  });
});

describe('forecast window', () => {
  it('covers today and the next 15 days', () => {
    expect(inForecastWindow('2026-11-20', '2026-11-20')).toBe(true);
    expect(inForecastWindow('2026-12-05', '2026-11-20')).toBe(true);
    expect(inForecastWindow('2026-12-06', '2026-11-20')).toBe(false);
    expect(inForecastWindow('2026-11-19', '2026-11-20')).toBe(false);
  });
});

describe('parseOpenMeteo', () => {
  it('parses daily arrays into a date map', () => {
    const out = parseOpenMeteo({
      time: ['2026-11-20'],
      weather_code: [61],
      temperature_2m_max: [4.2],
      temperature_2m_min: [-1],
      precipitation_sum: [6.1],
      precipitation_probability_max: [80],
      sunrise: ['2026-11-20T08:40'],
      sunset: ['2026-11-20T15:30'],
      daylight_duration: [24600],
    });
    expect(out['2026-11-20']).toMatchObject({ code: 61, tMax: 4.2, sunrise: '08:40', sunset: '15:30', daylightHours: 6.8, source: 'forecast' });
    expect(isWetOrSevere(out['2026-11-20'])).toBe(true);
  });
});

describe('tipsForDay', () => {
  const day: DayPlan = {
    day: 1,
    theme: 'x',
    area: 'Helsinki',
    destination_id: 'helsinki',
    is_day_trip: false,
    weather_sensitivity: 'outdoor',
    day_cost_eur: 0,
    route: { transport_mode: 'Walking', total_distance_km: 1, route_summary: '', waypoints: [{ name: 'a', lat: 60.17, lon: 24.94, kind: 'stop' }] },
    stops: [],
  };
  it('warns about rain on outdoor days', () => {
    const tips = tipsForDay(day, { ...climateDay('2027-08-01', makeDestination().climate.monthly), code: 63, precipMm: 8 }, [], new Set());
    expect(tips.some((t) => t.level === 'warning')).toBe(true);
  });
});
