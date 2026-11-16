import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search, Trash2 } from "lucide-react";
import { QualityBadge } from "./ConfidenceBadge";
import type { RecordingSummary } from "../types";

type SortKey = "upload_date" | "filename" | "location" | "species_count" | "duration";

interface Props {
  recordings: RecordingSummary[];
  loading?: boolean;
  onDelete?: (fileId: string) => void;
  deletingId?: string | null;
}

export default function HistoryTable({ recordings, loading, onDelete, deletingId }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("upload_date");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? recordings.filter((r) =>
          [r.filename, r.location ?? "", r.quality_label ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : recordings;
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [recordings, filter, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((a) => !a);
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
    >
      {label}
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <Search className="h-4 w-4 text-slate-400" />
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by file, location…"
          className="w-full bg-transparent text-sm outline-none"
          aria-label="Filter recordings"
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm" aria-label="Recording history">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
            <tr>
              {header("upload_date", "Date")}
              {header("filename", "File")}
              {header("location", "Location")}
              {header("species_count", "Species")}
              {header("duration", "Length")}
              <th scope="col" className="px-3 py-2 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className={loading ? "opacity-60" : undefined}>
            {rows.map((r) => (
              <tr
                key={r.file_id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
              >
                <td className="whitespace-nowrap px-3 py-2.5 text-slate-500 dark:text-slate-400">
                  {r.upload_date ? new Date(r.upload_date).toLocaleDateString() : "—"}
                </td>
                <td className="max-w-56 truncate px-3 py-2.5">
                  <Link to={`/results/${r.file_id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {r.filename}
                  </Link>
                  {r.quality_label && (
                    <span className="ml-2 align-middle">
                      <QualityBadge label={r.quality_label} score={r.quality_score ?? undefined} />
                    </span>
                  )}
                </td>
                <td className="max-w-40 truncate px-3 py-2.5 text-slate-500 dark:text-slate-400">
                  {r.location ?? "—"}
                </td>
                <td className="px-3 py-2.5 tabular-nums">{r.species_count}</td>
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                  {r.duration != null ? `${Math.floor(r.duration / 60)}:${String(Math.floor(r.duration % 60)).padStart(2, "0")}` : "—"}
                </td>
                <td className="px-3 py-2.5">
                  {confirmDelete === r.file_id ? (
                    <span className="inline-flex items-center gap-2 text-xs">
                      <button
                        onClick={() => {
                          onDelete?.(r.file_id);
                          setConfirmDelete(null);
                        }}
                        className="rounded bg-red-500 px-2 py-1 font-medium text-white hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button onClick={() => setConfirmDelete(null)} className="text-slate-400 hover:text-slate-600">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      aria-label={`Delete ${r.filename}`}
                      onClick={() => setConfirmDelete(r.file_id)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-400">
                  {filter ? "No recordings match this filter." : "No recordings yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {confirmDelete && deletingId && (
        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400 dark:border-slate-800">
          Deleting…
        </p>
      )}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-3 text-sm">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        <ChevronLeft className="h-4 w-4" /> Previous
      </button>
      <span className="tabular-nums text-slate-500 dark:text-slate-400">
        Page {page} of {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Next <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
