import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Search, Sparkles, X } from 'lucide-react';
import { useData } from '../data/DataProvider';
import { useDebounce } from '../hooks/useDebounce';
import { suggest, type Suggestion } from '../lib/search';

interface Props {
  initialValue: string;
  onCity: (cityId: string) => void;
  onSubmit: (text: string) => void;
  onClear: () => void;
}

/** Accessible combobox: city / place autocomplete + smart natural-language search on Enter. */
export function SearchBar({ initialValue, onCity, onSubmit, onClear }: Props) {
  const { destinations, places } = useData();
  const navigate = useNavigate();
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(value, 120);

  useEffect(() => setValue(initialValue), [initialValue]);

  const suggestions = useMemo(() => suggest(destinations, places, debounced), [destinations, places, debounced]);

  const choose = (s: Suggestion) => {
    setOpen(false);
    setActive(-1);
    if (s.kind === 'city') {
      setValue('');
      onCity(s.id);
    } else {
      navigate(`/place/${s.id}`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && suggestions[active]) choose(suggestions[active]);
      else {
        setOpen(false);
        onSubmit(value);
      }
    }
  };

  const showList = open && suggestions.length > 0 && value.trim().length > 0;

  return (
    <div className="search">
      <form
        className="search__box"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(false);
          onSubmit(value);
        }}
      >
        <Search size={20} className="search__icon" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          className="search__input"
          placeholder='Search 226 attractions across 40 cities...'
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search by city, place or describe your trip"
          autoComplete="off"
          spellCheck={false}
        />
        {value && (
          <button
            type="button"
            className="icon-btn search__clear"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              onClear();
              inputRef.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        )}
        <button type="submit" className="btn btn--primary search__submit">
          <Sparkles size={16} aria-hidden /> <span>Find</span>
        </button>
      </form>
      {showList && (
        <ul id={listId} role="listbox" className="search__list">
          {suggestions.map((s, i) => (
            <li
              key={`${s.kind}-${s.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`search__option ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {s.kind === 'city' ? <Building2 size={16} aria-hidden /> : <MapPin size={16} aria-hidden />}
              <span className="search__option-label">{s.label}</span>
              <span className="search__option-sub">{s.kind === 'city' ? s.sublabel : `Place · ${s.sublabel}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
