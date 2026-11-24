import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Filters } from '../types';
import { defaultFilters, filtersFromParams, filtersToParams } from '../lib/filters';

/** Filter state stored in the URL so searches are shareable and survive reloads / back navigation. */
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);

  const update = useCallback(
    (patch: Partial<Filters>) => {
      setParams((prev) => filtersToParams({ ...filtersFromParams(prev), ...patch }), { replace: true });
    },
    [setParams],
  );

  const reset = useCallback(() => {
    const d = defaultFilters();
    setParams(filtersToParams({ ...d, date: filtersFromParams(params).date }), { replace: true });
  }, [setParams, params]);

  return { filters, update, reset };
}
