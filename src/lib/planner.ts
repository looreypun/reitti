import type { DayPlan, Place } from '../types';
import type { DailyWeather } from './weather';
import { describeWeatherCode, isWetOrSevere } from './weather';
import { haversineKm } from './geo';

export type TipLevel = 'info' | 'warning';

export interface DayTip {
  level: TipLevel;
  message: string;
  alternatives?: Place[];
  alternativesLabel?: string;
}

/** Indoor places close to a day's area, used as rainy-day swaps. */
export function indoorAlternatives(day: DayPlan, allPlaces: Place[], exclude: Set<string>, limit = 3): Place[] {
  const centre = day.route.waypoints.find((w) => w.kind === 'stop') ?? day.route.waypoints[0];
  if (!centre) return [];
  return allPlaces
    .filter((p) => p.indoor && !exclude.has(p.id) && haversineKm(p.coordinates, centre) < 25)
    .sort((a, b) => b.popularity_score - a.popularity_score)
    .slice(0, limit);
}

/** Place ids on this day that are outside their opening season for the given month. */
export function closedStopsForMonth(day: DayPlan, placesById: Map<string, Place>, month: number): Place[] {
  const ids = new Set(day.stops.map((s) => s.place_id).filter(Boolean) as string[]);
  return [...ids].map((id) => placesById.get(id)).filter((p): p is Place => !!p && !p.open_months.includes(month));
}

/** Season- and weather-aware, rule-based tips for one itinerary day. */
export function tipsForDay(
  day: DayPlan,
  weather: DailyWeather | undefined,
  allPlaces: Place[],
  placesInTrip: Set<string>,
  closed: Place[] = [],
): DayTip[] {
  const tips: DayTip[] = [];
  for (const p of closed) {
    tips.push({
      level: 'warning',
      message: `${p.name} is seasonal (${p.season_label}) and is likely closed on this date — skip it or swap in an alternative.`,
      alternatives: allPlaces
        .filter((a) => a.id !== p.id && !placesInTrip.has(a.id) && a.open_months.length === 12 &&haversineKm(a.coordinates, p.coordinates) < 20)
        .sort((a, b) => b.popularity_score - a.popularity_score)
        .slice(0, 3),
      alternativesLabel: 'Open year-round nearby',
    });
  }
  if (!weather) return tips;
  const { kind, label } = describeWeatherCode(weather.code);
  const outdoorHeavy = day.weather_sensitivity !== 'indoor';

  if (isWetOrSevere(weather) && outdoorHeavy) {
    tips.push({
      level: 'warning',
      message: `${label} expected (${weather.precipMm} mm). This day is mostly outdoors — consider swapping in an indoor stop or bringing waterproofs.`,
      alternatives: indoorAlternatives(day, allPlaces, placesInTrip),
      alternativesLabel: 'Indoor ideas',
    });
  }
  if (weather.tMin <= -15) {
    tips.push({ level: 'warning', message: `Extreme cold (down to ${Math.round(weather.tMin)}°C). Dress in layers, cover skin and plan warm-up breaks indoors.` });
  } else if (weather.tMax <= 0) {
    tips.push({ level: 'info', message: `Sub-zero day (${Math.round(weather.tMax)}°C max). Wear thermal layers, a hat and gloves; paths may be icy.` });
  }
  if (weather.tMax >= 25 && outdoorHeavy) {
    tips.push({ level: 'info', message: 'Warm day — carry water and plan a swim or shade break in the afternoon.' });
  }
  if (weather.daylightHours != null && weather.daylightHours < 5) {
    tips.push({ level: 'info', message: `Only ~${weather.daylightHours} h of daylight. Schedule outdoor stops around midday; evenings are dark — great for auroras in the north.` });
  }
  if (weather.daylightHours != null && weather.daylightHours >= 20) {
    tips.push({ level: 'info', message: 'Midnight-sun season: it barely gets dark — evening hikes and late sightseeing are easy.' });
  }
  if (kind === 'clear' && day.stops.some((s) => /aurora|northern lights/i.test(s.title))) {
    tips.push({ level: 'info', message: 'Clear skies forecast — good conditions for northern lights tonight!' });
  }
  return tips;
}
