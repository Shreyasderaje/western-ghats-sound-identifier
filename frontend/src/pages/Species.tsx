import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { ErrorAlert, EmptyState } from "../components/ErrorAlert";
import { SkeletonTable } from "../components/Loading";
import { getSpecies } from "../services/api";
import type { Category } from "../types";

export default function Species() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["species"],
    queryFn: getSpecies,
  });

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "all">("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!needle) return true;
      return `${s.common_name} ${s.scientific_name} ${s.habitat}`
        .toLowerCase()
        .includes(needle);
    });
  }, [data, query, category]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Species reference</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          The {data?.length ?? 30} Western Ghats birds and frogs this tool can suggest,
          with the habitat each call mapping is tuned for.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or habitat…"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700" role="tablist">
          {(["all", "bird", "frog"] as const).map((cat) => (
            <button
              key={cat}
              role="tab"
              aria-selected={category === cat}
              onClick={() => setCategory(cat)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition ${
                category === cat
                  ? "bg-primary-600 text-white"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {cat === "bird" ? "🐦 Birds" : cat === "frog" ? "🐸 Frogs" : "All"}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="card">
          <SkeletonTable rows={8} />
        </div>
      ) : isError ? (
        <ErrorAlert message={(error as Error).message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔍" title="No species match your search" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <article key={s.species_name} className="card p-5">
              <div className="mb-2 flex items-start justify-between gap-2">
                <h2 className="font-semibold leading-snug">{s.common_name}</h2>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize dark:bg-slate-800">
                  {s.category === "bird" ? "🐦" : "🐸"} {s.category}
                </span>
              </div>
              <p className="mb-2 text-sm italic text-slate-400">{s.scientific_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{s.habitat}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
