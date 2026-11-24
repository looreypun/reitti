// Types mirroring public/data.json (schema 3.0)

export type PriceRange = 'free' | 'budget' | 'mid' | 'high';

export type StopType =
  | 'transport'
  | 'attraction'
  | 'museum'
  | 'nature'
  | 'food'
  | 'culture'
  | 'relaxation'
  | 'activity'
  | 'leisure'
  | 'walking';

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Stop {
  time: string;
  end_time?: string;
  title: string;
  type: StopType;
  place_id?: string;
  duration_mins?: number;
  cost_eur: number;
  indoor?: boolean;
  lat?: number;
  lon?: number;
  notes: string;
}

export interface Waypoint extends Coordinates {
  name: string;
  kind?: 'start' | 'stop' | 'end';
  place_id?: string;
}

export interface DayPlan {
  day: number;
  theme: string;
  area: string;
  destination_id: string;
  is_day_trip: boolean;
  weather_sensitivity: 'outdoor' | 'mixed' | 'indoor';
  day_cost_eur: number;
  route: {
    transport_mode: string;
    total_distance_km: number;
    route_summary: string;
    waypoints: Waypoint[];
  };
  stops: Stop[];
}

export interface Place {
  id: string;
  name: string;
  city: string;
  destination_id: string;
  region: string;
  image_url: string | null;
  image_thumb_url: string | null;
  image_alt: string;
  image_credit: string | null;
  wikipedia_url: string | null;
  popular: boolean;
  popularity_score: number;
  price_range: PriceRange;
  estimated_cost_eur: number;
  recommended_days: number[];
  tags: string[];
  indoor: boolean;
  coordinates: Coordinates;
  summary: string;
  tip: string;
  best_time_of_day: string;
  duration_mins: number;
  open_months: number[];
  season_label: string;
  access: 'city' | 'car' | 'ferry';
  itinerary: {
    max_days: number;
    note: string;
    total_cost_eur: number;
    days: DayPlan[];
  };
}

export interface ClimateMonth {
  month: number;
  avg_high_c: number;
  avg_low_c: number;
  precip_mm: number;
  daylight_hours: number;
}

export interface Destination {
  id: string;
  city: string;
  region: string;
  country: string;
  description: string;
  image_url: string | null;
  image_thumb_url: string | null;
  image_alt: string;
  wikipedia_url: string | null;
  coordinates: Coordinates;
  hub: { name: string; lat: number; lon: number };
  currency: string;
  has_tram: boolean;
  local_specialty: string;
  climate_zone: string;
  aurora_zone: boolean;
  climate: { source: string; monthly: ClimateMonth[] };
  nearby_destinations: { id: string; distance_km: number }[];
  top_tags: string[];
  place_count: number;
  places: Place[];
}

export interface TagInfo {
  id: string;
  label: string;
  count: number;
}

export interface PriceRangeInfo {
  id: PriceRange;
  label: string;
  description: string;
}

export interface Dataset {
  country: string;
  schema_version: string;
  generated_at: string;
  attribution: Record<string, string>;
  stats: { destinations: number; places: number; itinerary_days: number; stops: number };
  price_ranges: PriceRangeInfo[];
  tags_catalog: TagInfo[];
  destinations: Destination[];
}

export type SortKey = 'popular' | 'price-asc' | 'price-desc' | 'name' | 'relevance';

export interface Filters {
  q: string;
  city: string | null;
  popular: boolean;
  price: PriceRange[];
  days: number | null;
  tags: string[];
  tagMode: 'any' | 'all';
  date: string; // YYYY-MM-DD
  inSeason: boolean;
  sort: SortKey;
}
