import type { Coordinates } from '../types';

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Google Maps directions link through the given points (max 9 waypoints supported by the URL API). */
export function googleMapsDirectionsUrl(points: Coordinates[], travelmode: 'walking' | 'transit' | 'driving' = 'transit') {
  if (points.length === 0) return 'https://www.google.com/maps';
  const fmt = (p: Coordinates) => `${p.lat},${p.lon}`;
  const origin = points[0];
  const destination = points[points.length - 1];
  const middle = points.slice(1, -1).slice(0, 9);
  const params = new URLSearchParams({ api: '1', origin: fmt(origin), destination: fmt(destination), travelmode });
  if (middle.length) params.set('waypoints', middle.map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function googleMapsPlaceUrl(p: Coordinates, name: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${p.lat},${p.lon}`)}`;
}
