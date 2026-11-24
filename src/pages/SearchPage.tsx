import { useMemo, useState } from 'react';
import { SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useFilters } from '../hooks/useFilters';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { filterPlaces } from '../lib/search';
import { activeFilterCount } from '../lib/filters';
import { parseSmartQuery } from '../lib/smartQuery';
import { formatDate } from '../lib/dates';
import { pluralize } from '../lib/format';
import type { SortKey } from '../types';
import { SearchBar } from '../components/SearchBar';
import { FilterPanel } from '../components/FilterPanel';
import { PlaceCard } from '../components/PlaceCard';
import { CityBanner } from '../components/CityBanner';
import { EmptyState } from '../components/Feedback';
import { useTagLabel } from '../components/TagList';

const PAGE_SIZE = 24;

export default function SearchPage() {
  const { places, destinationsById, dataset } = useData();
  const { filters, update, reset } = useFilters();
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [understood, setUnderstood] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const tagLabel = useTagLabel();
  const city = filters.city ? destinationsById.get(filters.city) : undefined;
  useDocumentTitle(city ? `Things to do in ${city.city}` : undefined);

  const results = useMemo(() => filterPlaces(places, filters), [places, filters]);
  const activeCount = activeFilterCount(filters);

  const patch = (p: Parameters<typeof update>[0]) => {
    setLimit(PAGE_SIZE);
    update(p);
  };

  const handleSmartSubmit = (text: string) => {
    const parsed = parseSmartQuery(text, [...destinationsById.values()], dataset.tags_catalog);
    const structured = parsed.understood.length > 0;
    setUnderstood(parsed.understood);
    patch(
      structured
        ? {
            q: parsed.rest,
            city: parsed.city ?? filters.city,
            tags: parsed.tags.length ? parsed.tags : filters.tags,
            price: parsed.price.length ? parsed.price : filters.price,
            days: parsed.days ?? filters.days,
            popular: parsed.popular || filters.popular,
            inSeason: parsed.inSeason || filters.inSeason,
          }
        : { q: text },
    );
  };

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.q) chips.push({ key: 'q', label: `“${filters.q}”`, clear: () => patch({ q: '' }) });
  if (city) chips.push({ key: 'city', label: city.city, clear: () => patch({ city: null }) });
  if (filters.popular) chips.push({ key: 'pop', label: 'Popular', clear: () => patch({ popular: false }) });
  filters.price.forEach((p) =>
    chips.push({ key: `p-${p}`, label: dataset.price_ranges.find((x) => x.id === p)?.label ?? p, clear: () => patch({ price: filters.price.filter((x) => x !== p) }) }),
  );
  if (filters.days) chips.push({ key: 'days', label: `${filters.days}-day trip`, clear: () => patch({ days: null }) });
  filters.tags.forEach((t) => chips.push({ key: `t-${t}`, label: tagLabel(t), clear: () => patch({ tags: filters.tags.filter((x) => x !== t) }) }));
  if (filters.inSeason) chips.push({ key: 'season', label: 'Open on date', clear: () => patch({ inSeason: false }) });

  return (
    <>
      <section className="hero">
        <div className="container">
          <h1>
            Discover Finland, <span>planned with AI.</span>
          </h1>
          <p className="hero__lead">
            Search {dataset.stats.places} attractions in {dataset.stats.destinations} cities, or ask our AI assistant in your own words. Filter by budget,
            interests and trip length, check the weather for your travel date, and get a day-by-day route plan.
          </p>
          <SearchBar
            initialValue={filters.q}
            onCity={(id) => {
              setUnderstood([]);
              patch({ city: id, q: '' });
            }}
            onSubmit={handleSmartSubmit}
            onClear={() => {
              setUnderstood([]);
              patch({ q: '' });
            }}
          />
          {understood.length > 0 && (
            <p className="smart-note" role="status">
              <Sparkles size={15} aria-hidden /> Smart search understood: {understood.map((u) => <strong key={u}>{u}</strong>)}
              <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => setUnderstood([])}>
                <X size={14} />
              </button>
            </p>
          )}
          <div className="quick-picks" aria-label="Popular cities">
            {['helsinki', 'rovaniemi', 'turku', 'tampere', 'savonlinna', 'levi'].map((id) => {
              const d = destinationsById.get(id);
              return d ? (
                <button key={id} type="button" className={`chip chip--hero ${filters.city === id ? 'is-on' : ''}`} onClick={() => patch({ city: id, q: '' })}>
                  {d.city}
                </button>
              ) : null;
            })}
          </div>
        </div>
      </section>

      <div className="container layout">
        <aside className={`sidebar ${drawerOpen ? 'is-open' : ''}`} aria-label="Filters">
          <div className="sidebar__mobile-head">
            <strong>Filters</strong>
            <button type="button" className="icon-btn" onClick={() => setDrawerOpen(false)} aria-label="Close filters">
              <X size={18} />
            </button>
          </div>
          <FilterPanel filters={filters} onChange={patch} onReset={reset} activeCount={activeCount} />
          <button type="button" className="btn btn--primary sidebar__apply" onClick={() => setDrawerOpen(false)}>
            Show {pluralize(results.length, 'place')}
          </button>
        </aside>
        {drawerOpen && <div className="backdrop" onClick={() => setDrawerOpen(false)} aria-hidden />}

        <section className="results" aria-live="polite">
          {city && <CityBanner destination={city} date={filters.date} onClear={() => patch({ city: null })} />}

          <div className="results__bar">
            <div>
              <h2 className="results__count">{pluralize(results.length, 'place')}</h2>
              <p className="hint">Weather shown for {formatDate(filters.date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
            <div className="results__actions">
              <button type="button" className="btn btn--ghost filters-toggle" onClick={() => setDrawerOpen(true)}>
                <SlidersHorizontal size={16} aria-hidden /> Filters{activeCount ? ` (${activeCount})` : ''}
              </button>
              <label className="sort">
                <span>Sort</span>
                <select className="input" value={filters.sort} onChange={(e) => patch({ sort: e.target.value as SortKey })}>
                  <option value="popular">{filters.q ? 'Best match' : 'Most popular'}</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="name">Name A–Z</option>
                </select>
              </label>
            </div>
          </div>

          {chips.length > 0 && (
            <ul className="active-chips" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <button type="button" className="chip is-on" onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
                    {c.label} <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" className="link-btn" onClick={() => { setUnderstood([]); reset(); }}>
                  Clear all
                </button>
              </li>
            </ul>
          )}

          {results.length === 0 ? (
            <EmptyState
              title="No places match"
              message="Try removing a filter, choosing a longer trip or another city."
              action={
                <button type="button" className="btn btn--primary" onClick={reset}>
                  Reset filters
                </button>
              }
            />
          ) : (
            <>
              <div className="grid">
                {results.slice(0, limit).map(({ place }) => (
                  <PlaceCard key={place.id} place={place} destination={destinationsById.get(place.destination_id)!} date={filters.date} days={filters.days} />
                ))}
              </div>
              {results.length > limit && (
                <div className="load-more">
                  <button type="button" className="btn btn--ghost" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                    Show more ({results.length - limit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
