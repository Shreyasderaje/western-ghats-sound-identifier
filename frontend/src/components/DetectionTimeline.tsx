import { useMemo, useState } from "react";
import { speciesColor } from "../types";
import type { Detection } from "../types";
import { fmt } from "./SpeciesTable";

interface Props {
  detections: Detection[];
  duration: number | null;
  selectedSpecies?: string | null;
  onSelectSpecies?: (species: string | null) => void;
}

/**
 * Horizontal detection timeline: one colored bar per call event, species
 * rows stacked; hover shows the exact window, click filters to that species.
 */
export default function DetectionTimeline({
  detections,
  duration,
  selectedSpecies,
  onSelectSpecies,
}: Props) {
  const total = Math.max(duration ?? 0, ...detections.map((d) => d.end_time), 1);

  const speciesOrder = useMemo(() => {
    const counts = new Map<string, number>();
    detections.forEach((d) => counts.set(d.species_name, (counts.get(d.species_name) ?? 0) + 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [detections]);

  const [hover, setHover] = useState<{ species: string; det: Detection } | null>(null);

  if (detections.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-400">
        No detections to show on the timeline.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Time ruler */}
      <div className="relative ml-44 h-4 select-none text-[10px] text-slate-400 sm:ml-52">
        {Array.from({ length: 7 }).map((_, i) => {
          const t = (total / 6) * i;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2"
              style={{ left: `${(t / total) * 100}%` }}
            >
              {fmt(t)}
            </span>
          );
        })}
      </div>

      <div className="space-y-1.5" role="list" aria-label="Detection timeline">
        {speciesOrder.map((species) => (
          <div key={species} className="flex items-center gap-2">
            <button
              className={`w-40 shrink-0 truncate text-left text-xs sm:w-48 ${
                selectedSpecies === species ? "font-bold" : "text-slate-500 dark:text-slate-400"
              } hover:text-primary-600`}
              onClick={() => onSelectSpecies?.(selectedSpecies === species ? null : species)}
              title={species}
            >
              {species}
            </button>
            <div className="relative h-5 flex-1 rounded bg-slate-100 dark:bg-slate-800">
              {detections
                .filter((d) => d.species_name === species)
                .map((d, i) => (
                  <button
                    key={i}
                    role="listitem"
                    aria-label={`${species} at ${fmt(d.start_time)}`}
                    className="absolute top-0 h-full min-w-[3px] rounded transition-opacity hover:opacity-100"
                    style={{
                      left: `${(d.start_time / total) * 100}%`,
                      width: `${Math.max(((d.end_time - d.start_time) / total) * 100, 0.6)}%`,
                      backgroundColor: speciesColor(species),
                      opacity: selectedSpecies && selectedSpecies !== species ? 0.25 : 0.85,
                    }}
                    onMouseEnter={() => setHover({ species, det: d })}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover({ species, det: d })}
                  />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ml-44 min-h-6 text-xs text-slate-500 dark:text-slate-400 sm:ml-52" aria-live="polite">
        {hover ? (
          <>
            <span className="font-medium">{hover.species}</span> · {fmt(hover.det.start_time)} →{" "}
            {fmt(hover.det.end_time)} · {(hover.det.confidence * 100).toFixed(0)}% confidence
          </>
        ) : (
          "Hover a bar for exact timings · click a species name to filter"
        )}
      </div>
    </div>
  );
}
