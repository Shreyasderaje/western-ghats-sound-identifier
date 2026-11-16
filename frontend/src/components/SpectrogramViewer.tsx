import { useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { speciesColor } from "../types";
import type { Detection } from "../types";
import { fmt } from "./SpeciesTable";

interface Props {
  spectrogramUrl: string;
  detections: Detection[];
  duration: number | null;
  loading?: boolean;
}

/**
 * Backend-rendered spectrogram with hover-able detection overlays.
 * Zoom toggles between the full recording and a 30-second window panned
 * by clicking the ruler below the image.
 */
export default function SpectrogramViewer({
  spectrogramUrl,
  detections,
  duration,
  loading,
}: Props) {
  const [zoomed, setZoomed] = useState(false);
  const [windowStart, setWindowStart] = useState(0);
  const [hoverDet, setHoverDet] = useState<Detection | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const total = Math.max(duration ?? 0, ...detections.map((d) => d.end_time), 1);
  const windowSeconds = 30;
  const viewStart = zoomed ? windowStart : 0;
  const viewEnd = zoomed ? Math.min(windowStart + windowSeconds, total) : total;
  const scale = total / (viewEnd - viewStart);

  const visible = detections.filter(
    (d) => d.end_time >= viewStart && d.start_time <= viewEnd
  );

  const positionPercent = (t: number) => {
    const clamped = Math.min(Math.max(t - viewStart, 0), viewEnd - viewStart);
    return (clamped / (viewEnd - viewStart)) * 100;
  };

  const handleImageClick = (event: React.MouseEvent) => {
    if (!zoomed) return;
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fraction = (event.clientX - rect.left) / rect.width;
    const center = viewStart + fraction * (viewEnd - viewStart);
    setWindowStart(Math.max(0, Math.min(center - windowSeconds / 2, total - windowSeconds)));
  };

  if (loading) {
    return (
      <div className="card flex h-64 items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        Generating spectrogram…
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
        <h3 className="font-semibold">Spectrogram</h3>
        <button
          onClick={() => setZoomed((z) => !z)}
          disabled={!zoomed && total <= windowSeconds}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
          {zoomed ? "Show full recording" : "Zoom to 30 s"}
        </button>
      </div>

      <div className="relative" onClick={handleImageClick} style={{ cursor: zoomed ? "crosshair" : "default" }}>
        <img
          ref={imgRef}
          src={spectrogramUrl}
          alt="Mel-spectrogram of the recording with detected calls highlighted"
          className="block w-full"
        />
        {/* Overlays are positioned over the image by percentage of the visible window. */}
        <div className="pointer-events-none absolute inset-0">
          {visible.map((d, i) => (
            <div
              key={i}
              className="absolute top-0 h-full border-y-2"
              style={{
                left: `${positionPercent(d.start_time)}%`,
                width: `${Math.max(((d.end_time - d.start_time) / (viewEnd - viewStart)) * 100, 0.5)}%`,
                borderColor: speciesColor(d.species_name),
                backgroundColor: `${speciesColor(d.species_name)}22`,
              }}
              onMouseEnter={() => setHoverDet(d)}
              onMouseLeave={() => setHoverDet(null)}
            />
          ))}
        </div>
      </div>

      {/* Time ruler */}
      <div className="relative h-6 border-t border-slate-100 bg-slate-50 text-[10px] dark:border-slate-800 dark:bg-slate-900">
        {Array.from({ length: 7 }).map((_, i) => {
          const t = viewStart + ((viewEnd - viewStart) / 6) * i;
          return (
            <span
              key={i}
              className="absolute top-1 -translate-x-1/2 text-slate-400"
              style={{ left: `${(i / 6) * 100}%` }}
            >
              {fmt(t)}
            </span>
          );
        })}
      </div>

      <div className="flex min-h-9 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
        {hoverDet ? (
          <span>
            <strong>{hoverDet.species_name}</strong> · {fmt(hoverDet.start_time)} →{" "}
            {fmt(hoverDet.end_time)} · {(hoverDet.confidence * 100).toFixed(0)}%
          </span>
        ) : (
          zoomed && <span>Click the spectrogram to pan the 30 s window.</span>
        )}
        {detections.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5">
            {scale !== 1 && <em className="not-italic text-primary-600">{scale.toFixed(1)}× zoom</em>}
            {visible.length} of {detections.length} detections shown
          </span>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 dark:border-slate-800">
        {[...new Set(detections.map((d) => d.species_name))].map((name) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: speciesColor(name) }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
