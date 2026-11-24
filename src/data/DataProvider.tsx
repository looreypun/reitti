import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Dataset, Destination, Place } from '../types';

export interface DataIndex {
  dataset: Dataset;
  destinations: Destination[];
  places: Place[];
  destinationsById: Map<string, Destination>;
  placesById: Map<string, Place>;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'ready'; data: DataIndex };

interface ContextValue {
  state: State;
  retry: () => void;
}

const DataContext = createContext<ContextValue | null>(null);

export function validateDataset(json: unknown): Dataset {
  const d = json as Partial<Dataset>;
  if (!d || typeof d !== 'object' || !Array.isArray(d.destinations)) {
    throw new Error('data.json is missing the "destinations" array');
  }
  for (const dest of d.destinations) {
    if (!dest.id || !dest.city || !Array.isArray(dest.places)) {
      throw new Error(`Invalid destination entry: ${JSON.stringify(dest).slice(0, 80)}`);
    }
  }
  return d as Dataset;
}

export function buildIndex(dataset: Dataset): DataIndex {
  const destinations = dataset.destinations;
  const places = destinations.flatMap((d) => d.places);
  return {
    dataset,
    destinations,
    places,
    destinationsById: new Map(destinations.map((d) => [d.id, d])),
    placesById: new Map(places.map((p) => [p.id, p])),
  };
}

export function DataProvider({ children, url = `${import.meta.env.BASE_URL}data.json` }: { children: ReactNode; url?: string }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    fetch(url, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load data (HTTP ${res.status})`);
        return res.json();
      })
      .then((json) => setState({ status: 'ready', data: buildIndex(validateDataset(json)) }))
      .catch((err: Error) => {
        if (err.name !== 'AbortError') setState({ status: 'error', error: err.message });
      });
    return () => ctrl.abort();
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const value = useMemo(() => ({ state, retry }), [state, retry]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataState() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useDataState must be used inside <DataProvider>');
  return ctx;
}

/** Use only below a component that has already checked status === 'ready'. */
export function useData(): DataIndex {
  const { state } = useDataState();
  if (state.status !== 'ready') throw new Error('Data not loaded yet');
  return state.data;
}
