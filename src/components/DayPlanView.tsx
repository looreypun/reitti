import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  Bus,
  Coffee,
  Compass,
  ExternalLink,
  Info,
  Landmark,
  Map as MapIcon,
  MountainSnow,
  Palette,
  Route,
  ShoppingBag,
  Sparkles,
  TreePine,
  TriangleAlert,
  Waves,
  type LucideProps,
} from 'lucide-react';
import type { DayPlan, StopType } from '../types';
import type { DailyWeather } from '../lib/weather';
import type { DayTip } from '../lib/planner';
import { formatDuration, formatEUR } from '../lib/format';
import { googleMapsDirectionsUrl } from '../lib/geo';
import { formatDate } from '../lib/dates';
import { describeWeatherCode, climateLabel } from '../lib/weather';
import { WeatherIcon } from './WeatherIcon';

const RouteMap = lazy(() => import('./RouteMap'));

const STOP_ICONS: Record<StopType, React.ComponentType<LucideProps>> = {
  transport: Bus,
  attraction: Landmark,
  museum: Landmark,
  nature: TreePine,
  food: Coffee,
  culture: Palette,
  relaxation: Waves,
  activity: MountainSnow,
  leisure: ShoppingBag,
  walking: Compass,
};

interface Props {
  day: DayPlan;
  date: string;
  weather?: DailyWeather;
  tips: DayTip[];
  /** place ids in this day that are closed (out of season) on `date` */
  closedIds?: Set<string>;
}

export function DayPlanView({ day, date, weather, tips, closedIds }: Props) {
  const travelMode = /car|regional/i.test(day.route.transport_mode) ? 'driving' : /tram|bus|ferry/i.test(day.route.transport_mode) ? 'transit' : 'walking';
  const mapsUrl = googleMapsDirectionsUrl(day.route.waypoints, travelMode);

  return (
    <section className="day-plan" aria-labelledby={`day-${day.day}-title`}>
      <header className="day-plan__head">
        <div>
          <p className="eyebrow">
            Day {day.day} · {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
            {day.is_day_trip && <span className="pill pill--soft">Day trip</span>}
          </p>
          <h3 id={`day-${day.day}-title`}>{day.theme}</h3>
        </div>
        {weather && (
          <div className="day-plan__weather" title={weather.source === 'climate' ? climateLabel(date) : 'Forecast'}>
            <WeatherIcon code={weather.code} size={28} />
            <div>
              <strong>
                {Math.round(weather.tMax)}° / {Math.round(weather.tMin)}°
              </strong>
              <span>{weather.source === 'forecast' ? describeWeatherCode(weather.code).label : 'Typical'}</span>
            </div>
          </div>
        )}
      </header>

      <div className="route-summary">
        <span>
          <Route size={16} aria-hidden /> {day.route.transport_mode}
        </span>
        <span>
          <MapIcon size={16} aria-hidden /> {day.route.total_distance_km} km
        </span>
        <span>{formatEUR(day.day_cost_eur)} est. per person</span>
        <span className={`sens sens--${day.weather_sensitivity}`}>{day.weather_sensitivity} day</span>
      </div>

      {tips.length > 0 && (
        <ul className="tips">
          {tips.map((tip, i) => (
            <li key={i} className={`tip tip--${tip.level}`}>
              {tip.level === 'warning' ? <TriangleAlert size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
              <div>
                <p>{tip.message}</p>
                {tip.alternatives && tip.alternatives.length > 0 && (
                  <p className="tip__alts">
                    {tip.alternativesLabel ?? 'Try instead'}:{' '}
                    {tip.alternatives.map((a, j) => (
                      <span key={a.id}>
                        {j > 0 && ', '}
                        <Link to={`/place/${a.id}`}>{a.name}</Link>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="day-plan__grid">
        <ol className="timeline">
          {day.stops.map((s, i) => {
            const Icon = STOP_ICONS[s.type] ?? Info;
            const closed = !!s.place_id && !!closedIds?.has(s.place_id);
            return (
              <li key={i} className={`timeline__item timeline__item--${s.type} ${closed ? 'is-closed' : ''}`}>
                <div className="timeline__time">
                  <time>{s.time}</time>
                  {s.end_time && <span>{s.end_time}</span>}
                </div>
                <div className="timeline__dot" aria-hidden>
                  <Icon size={15} />
                </div>
                <div className="timeline__body">
                  <h4>
                    {s.place_id && !s.title.endsWith('(continued)') ? <Link to={`/place/${s.place_id}`}>{s.title}</Link> : s.title}
                  </h4>
                  <p className="timeline__meta">
                    <span className="type">{s.type}</span>
                    {s.duration_mins != null && <span>{formatDuration(s.duration_mins)}</span>}
                    <span>{formatEUR(s.cost_eur, true)}</span>
                    {s.indoor && s.type !== 'food' && <span>Indoor</span>}
                    {closed && <span className="closed-badge">May be closed on this date</span>}
                  </p>
                  {s.notes && <p className="timeline__notes">{s.notes}</p>}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="day-plan__map">
          <Suspense fallback={<div className="route-map route-map--loading">Loading map…</div>}>
            <RouteMap waypoints={day.route.waypoints} />
          </Suspense>
          <p className="route-text">{day.route.route_summary}</p>
          <a className="btn btn--ghost" href={mapsUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={16} aria-hidden /> Open route in Google Maps
          </a>
        </div>
      </div>
    </section>
  );
}
