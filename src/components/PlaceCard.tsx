import { Link } from 'react-router-dom';
import { CalendarX2, Clock, Flame, MapPin } from 'lucide-react';
import type { Destination, Place } from '../types';
import { formatDuration, formatEUR } from '../lib/format';
import { isInSeason } from '../lib/search';
import { PlaceImage } from './PlaceImage';
import { WeatherBadge } from './WeatherBadge';
import { TagList } from './TagList';

interface Props {
  place: Place;
  destination: Destination;
  date: string;
  days: number | null;
}

export function PlaceCard({ place, destination, date, days }: Props) {
  const params = new URLSearchParams();
  if (days) params.set('days', String(days));
  params.set('date', date);
  const outOfSeason = !isInSeason(place, date);

  return (
    <article className="card place-card">
      <Link to={`/place/${place.id}?${params}`} className="place-card__link" aria-label={`${place.name}, ${place.city}`}>
        <div className="place-card__media">
          <PlaceImage src={place.image_thumb_url} alt={place.image_alt} tags={place.tags} />
          <div className="place-card__overlay">
            {place.popular && (
              <span className="pill pill--accent">
                <Flame size={13} aria-hidden /> Popular
              </span>
            )}
            <WeatherBadge destination={destination} date={date} />
          </div>
        </div>
        <div className="place-card__body">
          <div className="place-card__meta">
            <span>
              <MapPin size={14} aria-hidden /> {place.city}
            </span>
            <span
              className={`price price--${place.price_range}`}
              title={place.estimated_cost_eur ? 'Estimated cost per adult' : 'No entry fee'}
            >
              {formatEUR(place.estimated_cost_eur)}
            </span>
          </div>
          <h3 className="place-card__title">{place.name}</h3>
          <p className="place-card__summary">{place.summary}</p>
          <TagList tags={place.tags.slice(0, 4)} />
          <div className="place-card__footer">
            <span>
              <Clock size={14} aria-hidden /> {formatDuration(place.duration_mins)}
            </span>
            <span>{place.recommended_days.length > 1 ? `1–${place.itinerary.max_days} day plans` : '1 day plan'}</span>
          </div>
          {outOfSeason && (
            <p className="place-card__warning">
              <CalendarX2 size={14} aria-hidden /> Seasonal: {place.season_label}
            </p>
          )}
        </div>
      </Link>
    </article>
  );
}
