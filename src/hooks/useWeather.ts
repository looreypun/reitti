import { useEffect, useState } from 'react';
import type { Destination } from '../types';
import { getWeatherRange, type DailyWeather } from '../lib/weather';

interface WeatherState {
  loading: boolean;
  days: DailyWeather[];
}

/** Weather for `count` days starting at `date` for a destination (forecast or climate fallback). */
export function useWeather(dest: Destination | undefined, date: string, count = 1): WeatherState {
  const [state, setState] = useState<WeatherState>({ loading: true, days: [] });

  useEffect(() => {
    if (!dest) return;
    let cancelled = false;
    setState((s) => ({ loading: true, days: s.days }));
    getWeatherRange(dest, date, count).then((days) => {
      if (!cancelled) setState({ loading: false, days });
    });
    return () => {
      cancelled = true;
    };
  }, [dest, date, count]);

  return state;
}
