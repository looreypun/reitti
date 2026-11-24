import type { ClimateMonth, Destination } from '../types';
import { addDays, daysBetween, monthOf, todayISO, MONTH_NAMES } from './dates';

export type WeatherSource = 'forecast' | 'climate';

export interface DailyWeather {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipMm: number;
  precipProbability: number | null;
  windMaxKmh: number | null;
  sunrise: string | null;
  sunset: string | null;
  daylightHours: number | null;
  source: WeatherSource;
}

export type WeatherKind = 'clear' | 'partly' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';

/** WMO weather interpretation codes → label + kind. */
export function describeWeatherCode(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: 'Clear sky', kind: 'clear' };
  if (code === 1) return { label: 'Mainly clear', kind: 'clear' };
  if (code === 2) return { label: 'Partly cloudy', kind: 'partly' };
  if (code === 3) return { label: 'Overcast', kind: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Fog', kind: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', kind: 'drizzle' };
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Heavy rain' : 'Rain', kind: 'rain' };
  if (code >= 71 && code <= 77) return { label: code >= 75 ? 'Heavy snow' : 'Snow', kind: 'snow' };
  if (code >= 80 && code <= 82) return { label: 'Rain showers', kind: 'rain' };
  if (code === 85 || code === 86) return { label: 'Snow showers', kind: 'snow' };
  if (code >= 95) return { label: 'Thunderstorm', kind: 'storm' };
  return { label: 'Unknown', kind: 'cloudy' };
}

export function isWetOrSevere(w: DailyWeather): boolean {
  const { kind } = describeWeatherCode(w.code);
  return kind === 'rain' || kind === 'storm' || (kind === 'snow' && w.precipMm >= 5) || w.precipMm >= 4;
}

/** Estimate a "typical day" from monthly climate normals when no forecast is available. */
export function climateDay(date: string, climate: ClimateMonth[]): DailyWeather {
  const m = climate.find((c) => c.month === monthOf(date)) ?? climate[0];
  const cold = m.avg_high_c <= 1;
  // Nordic winters are predominantly overcast; summers alternate sun and showers.
  let code: number;
  if (cold) code = m.precip_mm >= 45 ? 71 : 3;
  else if (m.precip_mm >= 60) code = 61;
  else if (m.precip_mm >= 45) code = 3;
  else if (m.precip_mm < 35) code = 1;
  else code = 2;
  return {
    date,
    code,
    tMax: m.avg_high_c,
    tMin: m.avg_low_c,
    precipMm: Math.round((m.precip_mm / 30) * 10) / 10,
    precipProbability: null,
    windMaxKmh: null,
    sunrise: null,
    sunset: null,
    daylightHours: m.daylight_hours,
    source: 'climate',
  };
}

export function climateLabel(date: string) {
  return `Typical ${MONTH_NAMES[monthOf(date) - 1]} weather`;
}

// ------------------------------------------------------------- forecast client

const FORECAST_DAYS = 16;
const TTL_MS = 30 * 60 * 1000;
const STORAGE_PREFIX = 'wx:v1:';

interface CacheEntry {
  fetchedAt: number;
  days: Record<string, DailyWeather>;
}

const memory = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CacheEntry>>();

function readStorage(key: string): CacheEntry | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ? (JSON.parse(raw) as CacheEntry) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, entry: CacheEntry) {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage unavailable or full — memory cache still works */
  }
}

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
  precipitation_probability_max?: (number | null)[];
  wind_speed_10m_max?: (number | null)[];
  sunrise?: string[];
  sunset?: string[];
  daylight_duration?: number[];
}

export function parseOpenMeteo(daily: OpenMeteoDaily): Record<string, DailyWeather> {
  const out: Record<string, DailyWeather> = {};
  daily.time.forEach((date, i) => {
    if (daily.weather_code[i] == null || daily.temperature_2m_max[i] == null) return;
    out[date] = {
      date,
      code: daily.weather_code[i],
      tMax: daily.temperature_2m_max[i],
      tMin: daily.temperature_2m_min[i],
      precipMm: daily.precipitation_sum[i] ?? 0,
      precipProbability: daily.precipitation_probability_max?.[i] ?? null,
      windMaxKmh: daily.wind_speed_10m_max?.[i] ?? null,
      sunrise: daily.sunrise?.[i]?.slice(11, 16) ?? null,
      sunset: daily.sunset?.[i]?.slice(11, 16) ?? null,
      daylightHours: daily.daylight_duration?.[i] != null ? Math.round((daily.daylight_duration[i] / 3600) * 10) / 10 : null,
      source: 'forecast',
    };
  });
  return out;
}

async function fetchForecast(dest: Destination, signal?: AbortSignal): Promise<CacheEntry> {
  const params = new URLSearchParams({
    latitude: String(dest.coordinates.lat),
    longitude: String(dest.coordinates.lon),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'wind_speed_10m_max',
      'sunrise',
      'sunset',
      'daylight_duration',
    ].join(','),
    timezone: 'Europe/Helsinki',
    forecast_days: String(FORECAST_DAYS),
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!res.ok) throw new Error(`Weather service responded ${res.status}`);
  const json = (await res.json()) as { daily?: OpenMeteoDaily };
  if (!json.daily) throw new Error('Unexpected weather response');
  return { fetchedAt: Date.now(), days: parseOpenMeteo(json.daily) };
}

async function getForecast(dest: Destination): Promise<CacheEntry> {
  const fresh = (e: CacheEntry | null | undefined): e is CacheEntry => !!e && Date.now() - e.fetchedAt < TTL_MS;
  const mem = memory.get(dest.id);
  if (fresh(mem)) return mem;
  const stored = readStorage(dest.id);
  if (fresh(stored)) {
    memory.set(dest.id, stored);
    return stored;
  }
  const existing = inflight.get(dest.id);
  if (existing) return existing;
  const p = fetchForecast(dest)
    .then((entry) => {
      memory.set(dest.id, entry);
      writeStorage(dest.id, entry);
      return entry;
    })
    .finally(() => inflight.delete(dest.id));
  inflight.set(dest.id, p);
  return p;
}

/** True when a date can be served by the live forecast (today … +15 days). */
export function inForecastWindow(date: string, today = todayISO()): boolean {
  const diff = daysBetween(today, date);
  return diff >= 0 && diff < FORECAST_DAYS;
}

/**
 * Weather for `count` consecutive days starting at `startDate`.
 * Uses the live forecast where possible and climate normals elsewhere,
 * so the UI always has something sensible to show (even offline).
 */
export async function getWeatherRange(dest: Destination, startDate: string, count: number): Promise<DailyWeather[]> {
  const dates = Array.from({ length: count }, (_, i) => addDays(startDate, i));
  const needsForecast = dates.some((d) => inForecastWindow(d));
  let forecast: Record<string, DailyWeather> = {};
  if (needsForecast) {
    try {
      forecast = (await getForecast(dest)).days;
    } catch {
      forecast = {}; // network failure → climate fallback below
    }
  }
  return dates.map((d) => forecast[d] ?? climateDay(d, dest.climate.monthly));
}

/** Test helper */
export function __clearWeatherCache() {
  memory.clear();
  inflight.clear();
}
