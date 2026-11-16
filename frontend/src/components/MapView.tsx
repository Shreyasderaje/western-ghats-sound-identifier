import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { speciesColor } from "../types";
import type { RecordingSummary } from "../types";

interface Props {
  recordings: RecordingSummary[];
  height?: number;
}

/**
 * Recording-location map (Leaflet + OpenStreetMap), loaded lazily so the
 * heavy leaflet bundle never enters the main chunk or the test environment.
 * Markers are colored by the most-detected species of each recording; hover
 * shows the recording summary, click opens its results page.
 */
export default function MapView({ recordings, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [map, setMap] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const points = recordings.filter((r) => r.latitude != null && r.longitude != null);

  useEffect(() => {
    let cancelled = false;
    let instance: unknown = null;

    (async () => {
      if (points.length === 0) return;
      try {
        const L = (await import("leaflet")).default;
        await import("leaflet/dist/leaflet.css");
        if (cancelled || !containerRef.current) return;

        instance = L.map(containerRef.current, { scrollWheelZoom: false }).setView(
          [13.5, 75.5], // Western Ghats spine
          6
        );
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 18,
        }).addTo(instance as never);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (instance as any)._wgsiMarkers = [];
        setMap(instance);
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (instance) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (instance as any)?.remove?.();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.length > 0]);

  // (Re)draw markers whenever recordings or the map instance change.
  useEffect(() => {
    if (!map) return;
    let cancelled = false;
    import("leaflet").then(({ default: L }) => {
      if (cancelled) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any)._wgsiMarkers.forEach((m: any) => m.remove());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any)._wgsiMarkers = points.map((r) => {
        const circle = L.circleMarker([r.latitude!, r.longitude!], {
          radius: 10,
          color: "#0f766e",
          weight: 1.5,
          fillColor: speciesColor(r.filename),
          fillOpacity: 0.8,
        });
        circle.bindTooltip(
          `<strong>${r.filename}</strong><br/>${r.location ?? ""}<br/>${r.species_count} species · ${r.detection_count} calls`,
          { direction: "top" }
        );
        return circle.addTo(map);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [map, recordings]);

  if (points.length === 0) {
    return (
      <div
        className="card flex flex-col items-center justify-center gap-2 text-center text-sm text-slate-400"
        style={{ height }}
      >
        <MapPin className="h-6 w-6" />
        No geotagged recordings yet — add a location with coordinates when uploading.
      </div>
    );
  }

  if (error) {
    return (
      <div className="card flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        Map could not be loaded.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div ref={containerRef} style={{ height }} role="img" aria-label="Map of recording locations" />
    </div>
  );
}
