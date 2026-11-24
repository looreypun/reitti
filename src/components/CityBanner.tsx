import { Sun, UtensilsCrossed, X } from 'lucide-react';
import type { Destination } from '../types';
import { useWeather } from '../hooks/useWeather';
import { describeWeatherCode, climateLabel } from '../lib/weather';
import { monthOf, formatDate } from '../lib/dates';
import { PlaceImage } from './PlaceImage';
import { WeatherIcon } from './WeatherIcon';

export function CityBanner({ destination, date, onClear }: { destination: Destination; date: string; onClear: () => void }) {
  const { days } = useWeather(destination, date, 1);
  const w = days[0];
  const climate = destination.climate.monthly[monthOf(date) - 1];

  return (
    <section className="city-banner card" aria-label={`About ${destination.city}`}>
      <PlaceImage src={destination.image_thumb_url} alt={destination.image_alt} tags={destination.top_tags} className="city-banner__img" />
      <div className="city-banner__body">
        <div className="city-banner__title-row">
          <div>
            <p className="eyebrow">{destination.region}</p>
            <h2>{destination.city}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClear} aria-label="Show all of Finland">
            <X size={18} />
          </button>
        </div>
        <p>{destination.description}</p>
        <div className="city-banner__facts">
          {w && (
            <span title={w.source === 'climate' ? climateLabel(date) : 'Forecast'}>
              <WeatherIcon code={w.code} size={18} /> {formatDate(date)}: {describeWeatherCode(w.code).label}, {Math.round(w.tMax)}° /{' '}
              {Math.round(w.tMin)}°{w.source === 'climate' && ' (typical)'}
            </span>
          )}
          {climate && (
            <span>
              <Sun size={16} aria-hidden /> ~{climate.daylight_hours} h daylight
            </span>
          )}
          <span>
            <UtensilsCrossed size={16} aria-hidden /> Try: {destination.local_specialty}
          </span>
        </div>
      </div>
    </section>
  );
}
