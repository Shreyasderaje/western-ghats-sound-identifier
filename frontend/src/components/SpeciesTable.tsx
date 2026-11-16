import { Fragment, useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import ConfidenceBadge from "./ConfidenceBadge";
import { speciesColor } from "../types";
import type { Detection, SpeciesSummary } from "../types";

type SortKey = "species_name" | "count" | "avg_confidence";

interface Props {
  perSpecies: SpeciesSummary[];
  detections: Detection[];
  onSelectSpecies?: (species: string | null) => void;
  selectedSpecies?: string | null;
}

export default function SpeciesTable({
  perSpecies,
  detections,
  onSelectSpecies,
  selectedSpecies,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("count");
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(selectedSpecies ?? null);

  const rows = useMemo(() => {
    const sorted = [...perSpecies].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [perSpecies, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((asc) => !asc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const header = (key: SortKey, label: string) => (
    <th
      scope="col"
      className="cursor-pointer select-none px-3 py-2 text-left font-medium"
      onClick={() => toggleSort(key)}
      aria-sort={sortKey === key ? (sortAsc ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label} <ArrowUpDown className="h-3 w-3 opacity-50" />
      </span>
    </th>
  );

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm" aria-label="Detected species">
        <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <tr>
            {header("species_name", "Species")}
            <th scope="col" className="px-3 py-2 text-left font-medium">Type</th>
            {header("count", "Calls")}
            {header("avg_confidence", "Confidence")}
            <th scope="col" className="px-3 py-2 text-left font-medium">Time range</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isOpen = expanded === row.species_name;
            const speciesDetections = isOpen
              ? detections
                  .filter((d) => d.species_name === row.species_name)
                  .sort((a, b) => a.start_time - b.start_time)
              : [];
            return (
              <Fragment key={row.species_name}>
                <tr
                  onClick={() => {
                    const next = isOpen ? null : row.species_name;
                    setExpanded(next);
                    onSelectSpecies?.(next);
                  }}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50 ${
                    selectedSpecies === row.species_name ? "bg-primary-50 dark:bg-primary-950/20" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: speciesColor(row.species_name) }}
                        aria-hidden
                      />
                      <span className="font-medium">{row.common_name ?? row.species_name}</span>
                      <span className="hidden italic text-slate-400 md:inline">
                        {row.species_name}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 capitalize">
                    {row.category === "bird" ? "🐦" : "🐸"} {row.category ?? "—"}
                  </td>
                  <td className="px-3 py-2.5">{row.count}</td>
                  <td className="px-3 py-2.5">
                    <ConfidenceBadge confidence={row.avg_confidence} />
                  </td>
                  <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400">
                    {fmt(row.first_seen ?? 0)} – {fmt(row.last_seen ?? 0)}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-slate-50 dark:bg-slate-900">
                    <td colSpan={5} className="px-3 py-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                        All detections of {row.common_name ?? row.species_name}
                      </p>
                      <ul className="space-y-1">
                        {speciesDetections.map((d, i) => (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-1.5 text-xs dark:bg-slate-800"
                          >
                            <span>
                              {fmt(d.start_time)} → {fmt(d.end_time)}
                            </span>
                            <span className="flex items-center gap-2">
                              <span className="text-slate-400">{d.yamnet_label}</span>
                              <ConfidenceBadge confidence={d.confidence} />
                            </span>
                          </li>
                        ))}
                        {speciesDetections.length === 0 && (
                          <li className="text-xs text-slate-400">
                            No individual detections stored for this species.
                          </li>
                        )}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-400">
                No detections at this confidence threshold.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
