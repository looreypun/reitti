import { useState } from 'react';
import { CalendarDays, ChevronDown, RotateCcw } from 'lucide-react';
import type { Filters, PriceRange } from '../types';
import { useData } from '../data/DataProvider';
import { addDays, todayISO } from '../lib/dates';
import { MAX_TRIP_DAYS } from '../lib/filters';

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
  activeCount: number;
}

const INITIAL_TAGS = 16;

export function FilterPanel({ filters, onChange, onReset, activeCount }: Props) {
  const { dataset, destinations } = useData();
  const [showAllTags, setShowAllTags] = useState(false);
  const tags = showAllTags ? dataset.tags_catalog : dataset.tags_catalog.slice(0, INITIAL_TAGS);
  // keep selected tags visible even if collapsed
  const visibleTags = [...tags, ...dataset.tags_catalog.filter((t) => filters.tags.includes(t.id) && !tags.includes(t))];

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  return (
    <div className="filters">
      <div className="filters__head">
        <h2 className="filters__title">Filters</h2>
        {activeCount > 0 && (
          <button type="button" className="link-btn" onClick={onReset}>
            <RotateCcw size={14} aria-hidden /> Reset ({activeCount})
          </button>
        )}
      </div>

      <fieldset className="filter-group">
        <legend>
          <CalendarDays size={16} aria-hidden /> Travel date
        </legend>
        <input
          type="date"
          className="input"
          value={filters.date}
          min={todayISO()}
          max={addDays(todayISO(), 365)}
          onChange={(e) => e.target.value && onChange({ date: e.target.value })}
          aria-label="Travel date"
        />
        <p className="hint">Live forecast for the next 16 days; typical climate after that.</p>
        <label className="check">
          <input type="checkbox" checked={filters.inSeason} onChange={(e) => onChange({ inSeason: e.target.checked })} />
          Only places open on this date
        </label>
      </fieldset>

      <fieldset className="filter-group">
        <legend>City</legend>
        <select className="input" value={filters.city ?? ''} onChange={(e) => onChange({ city: e.target.value || null })} aria-label="City">
          <option value="">All of Finland</option>
          {[...destinations]
            .sort((a, b) => a.city.localeCompare(b.city, 'fi'))
            .map((d) => (
              <option key={d.id} value={d.id}>
                {d.city} ({d.place_count})
              </option>
            ))}
        </select>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Price range</legend>
        <div className="chip-row">
          {dataset.price_ranges.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${filters.price.includes(p.id) ? 'is-on' : ''}`}
              aria-pressed={filters.price.includes(p.id)}
              onClick={() => onChange({ price: toggle<PriceRange>(filters.price, p.id) })}
              title={p.description}
            >
              {p.label}
              <span className="chip__sub">{p.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Trip length</legend>
        <div className="segmented" role="radiogroup" aria-label="Trip days">
          <button type="button" role="radio" aria-checked={!filters.days} className={!filters.days ? 'is-on' : ''} onClick={() => onChange({ days: null })}>
            Any
          </button>
          {Array.from({ length: MAX_TRIP_DAYS }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={filters.days === d}
              className={filters.days === d ? 'is-on' : ''}
              onClick={() => onChange({ days: d })}
            >
              {d}d
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend className="filter-group__legend-row">
          <span>Interests</span>
          {filters.tags.length > 1 && (
            <span className="mini-toggle">
              <button type="button" className={filters.tagMode === 'any' ? 'is-on' : ''} onClick={() => onChange({ tagMode: 'any' })}>
                any
              </button>
              <button type="button" className={filters.tagMode === 'all' ? 'is-on' : ''} onClick={() => onChange({ tagMode: 'all' })}>
                all
              </button>
            </span>
          )}
        </legend>
        <div className="chip-row">
          {visibleTags.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`chip chip--tag ${filters.tags.includes(t.id) ? 'is-on' : ''}`}
              aria-pressed={filters.tags.includes(t.id)}
              onClick={() => onChange({ tags: toggle(filters.tags, t.id) })}
            >
              {t.label} <span className="chip__count">{t.count}</span>
            </button>
          ))}
        </div>
        {dataset.tags_catalog.length > INITIAL_TAGS && (
          <button type="button" className="link-btn" onClick={() => setShowAllTags((s) => !s)} aria-expanded={showAllTags}>
            <ChevronDown size={14} className={showAllTags ? 'rot-180' : ''} aria-hidden />
            {showAllTags ? 'Fewer interests' : `All ${dataset.tags_catalog.length} interests`}
          </button>
        )}
      </fieldset>
    </div>
  );
}
