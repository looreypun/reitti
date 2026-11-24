import type { Destination, Place } from '../types';

export function makePlace(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p1',
    name: 'Test Place',
    city: 'Helsinki',
    destination_id: 'helsinki',
    region: 'Uusimaa',
    image_url: null,
    image_thumb_url: null,
    image_alt: '',
    image_credit: null,
    wikipedia_url: null,
    popular: true,
    popularity_score: 90,
    price_range: 'free',
    estimated_cost_eur: 0,
    recommended_days: [1, 2],
    tags: ['history'],
    indoor: false,
    coordinates: { lat: 60.17, lon: 24.94 },
    summary: 'A test place',
    tip: '',
    best_time_of_day: 'Morning',
    duration_mins: 60,
    open_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    season_label: 'Year-round',
    access: 'city',
    itinerary: { max_days: 2, note: '', total_cost_eur: 0, days: [] },
    ...overrides,
  };
}

export function makeDestination(overrides: Partial<Destination> = {}): Destination {
  return {
    id: 'helsinki',
    city: 'Helsinki',
    region: 'Uusimaa',
    country: 'Finland',
    description: '',
    image_url: null,
    image_thumb_url: null,
    image_alt: '',
    wikipedia_url: null,
    coordinates: { lat: 60.17, lon: 24.94 },
    hub: { name: 'Hub', lat: 60.17, lon: 24.94 },
    currency: 'EUR',
    has_tram: true,
    local_specialty: '',
    climate_zone: 'south',
    aurora_zone: false,
    climate: {
      source: '',
      monthly: Array.from({ length: 12 }, (_, i) => ({
        month: i + 1,
        avg_high_c: i < 2 || i === 11 ? -2 : 15,
        avg_low_c: i < 2 || i === 11 ? -8 : 8,
        precip_mm: i === 7 ? 80 : 40,
        daylight_hours: 10,
      })),
    },
    nearby_destinations: [],
    top_tags: [],
    place_count: 1,
    places: [],
    ...overrides,
  };
}
