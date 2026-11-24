import { useEffect, useMemo } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Waypoint } from '../types';

function numberedIcon(label: string, kind: Waypoint['kind']) {
  return L.divIcon({
    className: '',
    html: `<span class="map-pin map-pin--${kind ?? 'stop'}">${label}</span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
  });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 1) map.setView(points[0], 14);
    else if (points.length > 1) map.fitBounds(points, { padding: [36, 36], maxZoom: 15 });
  }, [map, points]);
  return null;
}

/** Interactive Leaflet map of a day's route (straight-line legs between waypoints). */
export default function RouteMap({ waypoints }: { waypoints: Waypoint[] }) {
  const points = useMemo(() => waypoints.map((w) => [w.lat, w.lon] as [number, number]), [waypoints]);
  let stopNo = 0;

  return (
    <MapContainer className="route-map" center={points[0] as LatLngExpression} zoom={12} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={points} pathOptions={{ color: '#1d63c9', weight: 4, opacity: 0.8, dashArray: '8 8' }} />
      {waypoints.map((w, i) => {
        const label = w.kind === 'start' ? 'S' : w.kind === 'end' ? 'E' : String(++stopNo);
        return (
          <Marker key={`${w.name}-${i}`} position={[w.lat, w.lon]} icon={numberedIcon(label, w.kind)}>
            <Popup>
              <strong>{w.name}</strong>
              <br />
              {w.kind === 'start' ? 'Start point' : w.kind === 'end' ? 'End point' : `Stop ${label}`}
            </Popup>
          </Marker>
        );
      })}
      <FitBounds points={points} />
    </MapContainer>
  );
}
