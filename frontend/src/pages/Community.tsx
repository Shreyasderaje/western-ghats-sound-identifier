import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Trophy } from "lucide-react";
import { ErrorAlert, EmptyState } from "../components/ErrorAlert";
import { SkeletonTable } from "../components/Loading";
import { Pagination } from "../components/HistoryTable";
import { getLeaderboard, getPublicRecordings } from "../services/api";

export default function Community() {
  const [page, setPage] = useState(1);
  const feed = useQuery({
    queryKey: ["public-recordings", page],
    queryFn: () => getPublicRecordings(page),
    placeholderData: (prev) => prev,
  });
  const leaderboard = useQuery({
    queryKey: ["leaderboard"],
    queryFn: getLeaderboard,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Recordings shared publicly by contributors, and the most active analysts.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Globe2 className="h-5 w-5 text-primary-500" /> Shared recordings
        </h2>
        {feed.isLoading ? (
          <div className="card">
            <SkeletonTable rows={4} />
          </div>
        ) : feed.isError ? (
          <ErrorAlert message={(feed.error as Error).message} onRetry={() => feed.refetch()} />
        ) : (feed.data?.recordings.length ?? 0) === 0 ? (
          <EmptyState
            icon="🌐"
            title="No shared recordings yet"
            hint="Share one of your analyzed recordings from its results page to see it here."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feed.data!.recordings.map((r) => (
              <Link
                key={r.file_id}
                to={`/results/${r.file_id}`}
                className="card block p-5 transition hover:border-primary-300 hover:shadow-md"
              >
                <p className="mb-1 truncate font-semibold">{r.filename}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {r.location ?? "Unknown location"}
                </p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-primary-600 dark:text-primary-400">
                    {r.species_count} species
                  </span>
                  <span className="text-slate-400">
                    {r.upload_date ? new Date(r.upload_date).toLocaleDateString() : ""}
                  </span>
                </div>
                {r.username && (
                  <p className="mt-2 text-xs text-slate-400">by {r.username}</p>
                )}
              </Link>
            ))}
          </div>
        )}
        <Pagination page={page} totalPages={feed.data?.total_pages ?? 1} onChange={setPage} />
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Trophy className="h-5 w-5 text-amber-500" /> Top contributors
        </h2>
        {leaderboard.isLoading ? (
          <div className="card">
            <SkeletonTable rows={3} />
          </div>
        ) : (leaderboard.data?.length ?? 0) === 0 ? (
          <EmptyState icon="🏆" title="No contributors yet" hint="Create an account and upload recordings to appear here." />
        ) : (
          <ol className="card divide-y divide-slate-100 dark:divide-slate-800">
            {leaderboard.data!.map((entry, i) => (
              <li key={entry.username} className="flex items-center gap-4 px-4 py-3">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                    i === 0
                      ? "bg-amber-100 text-amber-600"
                      : i === 1
                        ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        : i === 2
                          ? "bg-orange-100 text-orange-600"
                          : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{entry.username}</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {entry.recordings} recording{entry.recordings === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
