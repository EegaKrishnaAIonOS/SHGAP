import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export interface ActivityMapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Drives circle radius — real sales amount / recommendation count, never
   * a fabricated density value. */
  value: number;
  valueLabel: string;
}

export interface ActivityMapProps {
  points: ActivityMapPoint[];
  color?: string;
  height?: number;
  emptyMessage?: string;
}

// Roughly centres Andhra Pradesh; zoom 6 keeps all three pilot districts
// (Anantapur, Krishna, Visakhapatnam) on screen at once.
const AP_CENTER: [number, number] = [15.9129, 79.74];
const DEFAULT_ZOOM = 6;
const MIN_RADIUS = 8;
const MAX_EXTRA_RADIUS = 22;

/**
 * Discrete, value-scaled circle markers — not a smoothed heat-density
 * layer. With only a handful of real geo-tagged points in this pilot
 * (see ADR-0028), a true heatmap surface would visually imply a density
 * gradient that doesn't exist; honestly-sized markers over each real point
 * is what the actual data supports today. `CircleMarker` (not `Marker`)
 * deliberately avoids Leaflet's default-icon-path issue under Vite, which
 * only affects the pin-image `Marker`, not vector circle markers.
 */
export function ActivityMap({
  points,
  color = "#aa3bff",
  height = 360,
  emptyMessage,
}: ActivityMapProps) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed border-neutral-200 text-sm text-neutral-400"
        style={{ height }}
      >
        {emptyMessage ?? "No geo-tagged activity for the selected filters yet."}
      </div>
    );
  }

  const maxValue = Math.max(...points.map((p) => p.value), 1);

  return (
    <MapContainer
      center={AP_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height, width: "100%" }}
      scrollWheelZoom={false}
      className="rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => (
        <CircleMarker
          key={point.id}
          center={[point.lat, point.lng]}
          radius={MIN_RADIUS + (point.value / maxValue) * MAX_EXTRA_RADIUS}
          pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 1.5 }}
        >
          <Popup>
            <strong>{point.label}</strong>
            <br />
            {point.valueLabel}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
