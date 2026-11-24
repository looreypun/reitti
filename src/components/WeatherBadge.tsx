import type { Destination } from '../types';
import { useWeather } from '../hooks/useWeather';
import { climateLabel, describeWeatherCode } from '../lib/weather';
import { WeatherIcon } from './WeatherIcon';

export function WeatherBadge({ destination, date }: { destination: Destination; date: string }) {
  const { loading, days } = useWeather(destination, date, 1);
  const w = days[0];
  if (loading && !w) return <span className="wx-badge wx-badge--loading" aria-label="Loading weather" />;
  if (!w) return null;
  const { label } = describeWeatherCode(w.code);
  const title = w.source === 'forecast' ? `Forecast: ${label}` : `${climateLabel(date)} (no forecast yet)`;
  return (
    <span className={`wx-badge ${w.source === 'climate' ? 'wx-badge--climate' : ''}`} title={title}>
      <WeatherIcon code={w.code} size={16} />
      <span>
        {Math.round(w.tMax)}° / {Math.round(w.tMin)}°
      </span>
      {w.source === 'climate' && <span className="wx-badge__hint">avg</span>}
    </span>
  );
}
