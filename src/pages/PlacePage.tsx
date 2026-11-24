import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CalendarX2,
  Clock,
  Coins,
  Flame,
  Lightbulb,
  MapPin,
  Navigation,
  Printer,
  Share2,
  Sunrise,
  Sunset,
} from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useWeather } from '../hooks/useWeather';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { addDays, formatDate, isValidISODate, monthOf, todayISO } from '../lib/dates';
import { formatDuration, formatEUR, pluralize } from '../lib/format';
import { googleMapsPlaceUrl, haversineKm } from '../lib/geo';
import { isInSeason } from '../lib/search';
import { closedStopsForMonth, tipsForDay } from '../lib/planner';
import { climateLabel, describeWeatherCode } from '../lib/weather';
import { PlaceImage } from '../components/PlaceImage';
import { TagList } from '../components/TagList';
import { DayPlanView } from '../components/DayPlanView';
import { WeatherIcon } from '../components/WeatherIcon';
import { PlaceCard } from '../components/PlaceCard';
import NotFoundPage from './NotFoundPage';

export default function PlacePage() {
  const { placeId = '' } = useParams();
  const { placesById } = useData();
  const place = placesById.get(placeId);
  useDocumentTitle(place?.name);
  if (!place) return <NotFoundPage message="We couldn’t find that place. It may have been renamed." />;
  return <PlaceDetail key={place.id} placeId={place.id} />;
}

function PlaceDetail({ placeId }: { placeId: string }) {
  const { placesById, destinationsById, places } = useData();
  const place = placesById.get(placeId)!;  const destination = destinationsById.get(place.destination_id)!;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [copied, setCopied] = useState(false);

  const maxDays = place.itinerary.max_days;
  const requestedDays = Number(params.get('days'));
  const tripDays = Number.isInteger(requestedDays) && requestedDays >= 1 ? Math.min(requestedDays, maxDays) : 1;
  const dateParam = params.get('date');
  const startDate = isValidISODate(dateParam) && dateParam >= todayISO() ? dateParam : todayISO();
  const activeDay = Math.min(Math.max(Number(params.get('day')) || 1, 1), tripDays);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value == null) next.delete(key);
        else next.set(key, value);
        if (key === 'days') next.delete('day');
        return next;
      },
      { replace: true },
    );

  const days = place.itinerary.days.slice(0, tripDays);
  const { days: weather, loading: weatherLoading } = useWeather(destination, startDate, tripDays);
  const placesInTrip = useMemo(() => new Set(days.flatMap((d) => d.stops.map((s) => s.place_id).filter(Boolean) as string[])), [days]);
  const tripCost = days.reduce((s, d) => s + d.day_cost_eur, 0);
  const tripKm = days.reduce((s, d) => s + d.route.total_distance_km, 0);
  const attractions = placesInTrip.size;
  const outOfSeason = !isInSeason(place, startDate);
  const currentDay = days[activeDay - 1];
  const closedFor = (i: number) => closedStopsForMonth(days[i], placesById, monthOf(addDays(startDate, i)));
  const closedToday = closedFor(activeDay - 1);
  const tips = tipsForDay(currentDay, weather[activeDay - 1], places, placesInTrip, closedToday);

  const nearby = useMemo(
    () =>
      places
        .filter((p) => p.id !== place.id && !placesInTrip.has(p.id))
        .map((p) => ({ p, d: haversineKm(p.coordinates, place.coordinates) }))
        .filter((x) => x.d < 60)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3),
    [places, place, placesInTrip],
  );

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: place.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <article className="place-page">
      <div className="place-hero">
        <PlaceImage src={place.image_url} alt={place.image_alt} tags={place.tags} className="place-hero__img" eager />
        <div className="place-hero__shade" />
        <div className="container place-hero__content">
          <button type="button" className="btn btn--glass" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(`/?city=${destination.id}`))}>
            <ArrowLeft size={16} aria-hidden /> Back
          </button>
          <div>
            <p className="place-hero__loc">
              <MapPin size={16} aria-hidden />
              <span>
                <Link to={`/?city=${destination.id}`}>{destination.city}</Link>, {destination.region}
              </span>
            </p>
            <h1>{place.name}</h1>
            <div className="place-hero__pills">
              {place.popular && (
                <span className="pill pill--accent">
                  <Flame size={13} aria-hidden /> Popular
                </span>
              )}
              <span className="pill">Popularity {place.popularity_score}/100</span>
              <span className="pill" title={place.estimated_cost_eur ? 'Estimated cost per adult' : undefined}>
                {place.estimated_cost_eur ? `${formatEUR(place.estimated_cost_eur)} per adult` : 'Free entry'}
              </span>
              <span className="pill">{place.season_label}</span>
            </div>
          </div>
        </div>
        {place.image_credit && place.image_url && <span className="place-hero__credit">Photo: {place.image_credit}</span>}
      </div>

      <div className="container place-body">
        <section className="place-overview">
          <div className="place-overview__text">
            <p className="lead">{place.summary}</p>
            <p className="callout">
              <Lightbulb size={18} aria-hidden /> {place.tip}
            </p>
            <TagList tags={place.tags} />
            <div className="link-row">
              <a className="btn btn--ghost" href={googleMapsPlaceUrl(place.coordinates, place.name)} target="_blank" rel="noreferrer">
                <Navigation size={16} aria-hidden /> Open in Maps
              </a>
              {place.wikipedia_url && (
                <a className="btn btn--ghost" href={place.wikipedia_url} target="_blank" rel="noreferrer">
                  <BookOpen size={16} aria-hidden /> Wikipedia
                </a>
              )}
              <button type="button" className="btn btn--ghost" onClick={share}>
                <Share2 size={16} aria-hidden /> {copied ? 'Link copied!' : 'Share plan'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => window.print()}>
                <Printer size={16} aria-hidden /> Print
              </button>
            </div>
          </div>
          <dl className="facts card">
            <div>
              <dt>
                <Clock size={16} aria-hidden /> Visit length
              </dt>
              <dd>{formatDuration(place.duration_mins)}</dd>
            </div>
            <div>
              <dt>
                <Sunrise size={16} aria-hidden /> Best time
              </dt>
              <dd>{place.best_time_of_day}</dd>
            </div>
            <div>
              <dt>
                <Coins size={16} aria-hidden /> Entry estimate
              </dt>
              <dd>{formatEUR(place.estimated_cost_eur)}</dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={16} aria-hidden /> Open
              </dt>
              <dd>{place.season_label}</dd>
            </div>
            <div>
              <dt>
                <Navigation size={16} aria-hidden /> Getting there
              </dt>
              <dd>{place.access === 'ferry' ? 'Ferry / boat' : place.access === 'car' ? 'Car or excursion' : 'Public transport / walk'}</dd>
            </div>
          </dl>
        </section>

        <section className="planner card" aria-labelledby="planner-title">
          <div className="planner__head">
            <div>
              <h2 id="planner-title">Your trip plan</h2>
              <p className="hint">
                {pluralize(tripDays, 'day')} from {destination.city} · {pluralize(attractions, 'attraction')} · {Math.round(tripKm)} km · ~{formatEUR(tripCost)} per
                person
              </p>
            </div>
            <div className="planner__controls">
              <label className="field">
                <span>Start date</span>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  min={todayISO()}
                  max={addDays(todayISO(), 365)}
                  onChange={(e) => e.target.value && setParam('date', e.target.value)}
                />
              </label>
              <div className="field">
                <span>Trip length</span>
                <div className="segmented" role="radiogroup" aria-label="Trip length in days">
                  {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
                    <button key={d} type="button" role="radio" aria-checked={tripDays === d} className={tripDays === d ? 'is-on' : ''} onClick={() => setParam('days', String(d))}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {Number(params.get('days')) > maxDays && (
            <p className="callout callout--info">
              {place.name} supports plans up to {pluralize(maxDays, 'day')} with nearby attractions — showing the {maxDays}-day plan.
            </p>
          )}
          {outOfSeason && (
            <p className="callout callout--warning">
              <CalendarX2 size={18} aria-hidden /> {place.name} is seasonal ({place.season_label}) and may be closed on {formatDate(startDate)}. Pick another date or check
              the venue.
            </p>
          )}

          <div className="forecast-strip" aria-label="Weather for each trip day">
            {(weatherLoading && weather.length === 0 ? days.map(() => undefined) : weather).map((w, i) => {
              const date = addDays(startDate, i);
              return (
                <button
                  key={date}
                  type="button"
                  className={`forecast-day ${activeDay === i + 1 ? 'is-active' : ''}`}
                  onClick={() => setParam('day', String(i + 1))}
                  aria-pressed={activeDay === i + 1}
                >
                  <span className="forecast-day__label">Day {i + 1}</span>
                  <span className="forecast-day__date">{formatDate(date)}</span>
                  {w ? (
                    <>
                      <WeatherIcon code={w.code} size={26} />
                      <strong>
                        {Math.round(w.tMax)}° <span>{Math.round(w.tMin)}°</span>
                      </strong>
                      <span className="forecast-day__desc" title={w.source === 'climate' ? climateLabel(date) : undefined}>
                        {w.source === 'forecast' ? describeWeatherCode(w.code).label : 'Typical'}
                        {w.precipProbability != null && ` · ${w.precipProbability}%`}
                      </span>
                      {w.sunrise && w.sunset ? (
                        <span className="forecast-day__sun">
                          <Sunrise size={12} aria-hidden /> {w.sunrise} <Sunset size={12} aria-hidden /> {w.sunset}
                        </span>
                      ) : (
                        w.daylightHours != null && <span className="forecast-day__sun">{w.daylightHours} h daylight</span>
                      )}
                    </>
                  ) : (
                    <span className="skeleton skeleton--line" />
                  )}
                </button>
              );
            })}
          </div>

          <DayPlanView
            day={currentDay}
            date={addDays(startDate, activeDay - 1)}
            weather={weather[activeDay - 1]}
            tips={tips}
            closedIds={new Set(closedToday.map((p) => p.id))}
          />

          {tripDays > 1 && (
            <nav className="day-nav" aria-label="Day navigation">
              {activeDay > 1 ? (
                <button type="button" className="btn btn--ghost" onClick={() => setParam('day', String(activeDay - 1))}>
                  ← Day {activeDay - 1}
                </button>
              ) : (
                <span />
              )}
              {activeDay < tripDays && (
                <button type="button" className="btn btn--ghost" onClick={() => setParam('day', String(activeDay + 1))}>
                  Day {activeDay + 1} →
                </button>
              )}
            </nav>
          )}

          <div className="print-only">
            {days.map((d, i) =>
              i + 1 === activeDay ? null : (
                <DayPlanView
                  key={d.day}
                  day={d}
                  date={addDays(startDate, i)}
                  weather={weather[i]}
                  tips={[]}
                  closedIds={new Set(closedFor(i).map((p) => p.id))}
                />
              ),
            )}
          </div>
        </section>

        {nearby.length > 0 && (
          <section className="nearby" aria-labelledby="nearby-title">
            <h2 id="nearby-title">More nearby</h2>
            <div className="grid grid--3">
              {nearby.map(({ p }) => (
                <PlaceCard key={p.id} place={p} destination={destinationsById.get(p.destination_id)!} date={startDate} days={null} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
