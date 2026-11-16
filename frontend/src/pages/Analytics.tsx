import { useState } from "react";
import { Bird, Files, Mic2, Users } from "lucide-react";
import { TopSpeciesChart, TrendsChart } from "../components/AnalyticsCharts";
import { ErrorAlert } from "../components/ErrorAlert";
import HistoryTable, { Pagination } from "../components/HistoryTable";
import { SkeletonCards, SkeletonTable } from "../components/Loading";
import MapView from "../components/MapView";
import StatisticsCard from "../components/StatisticsCard";
import { useAnalytics, useDeleteRecording, useHistory } from "../hooks/useApi";

export default function Analytics() {
  const [page, setPage] = useState(1);
  const history = useHistory(page);
  const { summary, topSpecies, trends } = useAnalytics();
  const deleteRecording = useDeleteRecording();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics &amp; history</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your recordings, aggregate biodiversity statistics and detection trends.
        </p>
      </div>

      {/* Summary cards */}
      {summary.isLoading ? (
        <SkeletonCards />
      ) : summary.isError ? (
        <ErrorAlert message={(summary.error as Error).message} onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatisticsCard
            icon={<Files className="h-5 w-5" />}
            label="Recordings analyzed"
            value={summary.data.total_recordings}
          />
          <StatisticsCard
            icon={<Bird className="h-5 w-5" />}
            label="Unique species"
            value={summary.data.unique_species}
          />
          <StatisticsCard
            icon={<Mic2 className="h-5 w-5" />}
            label="Avg species / recording"
            value={summary.data.avg_species_per_recording}
            hint={`${summary.data.total_detections} total call events`}
          />
          <StatisticsCard
            icon={<Users className="h-5 w-5" />}
            label="Recordings this week"
            value={summary.data.recordings_this_week}
          />
        </div>
      ) : null}

      {/* History table */}
      <section className="space-y-3">
        <h2 className="font-semibold">Recording history</h2>
        <HistoryTable
          recordings={history.data?.recordings ?? []}
          loading={history.isLoading}
          onDelete={(id) => deleteRecording.mutate(id)}
          deletingId={deleteRecording.isPending ? "pending" : null}
        />
        <Pagination
          page={page}
          totalPages={history.data?.total_pages ?? 1}
          onChange={setPage}
        />
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Top species</h2>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Most frequently detected across all recordings
          </p>
          {topSpecies.isLoading ? (
            <SkeletonTable rows={6} />
          ) : topSpecies.isError ? (
            <ErrorAlert message={(topSpecies.error as Error).message} />
          ) : (
            <TopSpeciesChart species={topSpecies.data ?? []} />
          )}
        </section>

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Detection trends</h2>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Daily detections and unique species over time
          </p>
          {trends.isLoading ? (
            <SkeletonTable rows={6} />
          ) : trends.isError ? (
            <ErrorAlert message={(trends.error as Error).message} />
          ) : (
            <TrendsChart trends={trends.data ?? []} />
          )}
        </section>
      </div>

      {/* Location map */}
      <section className="space-y-3">
        <h2 className="font-semibold">Recording locations</h2>
        <MapView recordings={(history.data?.recordings ?? []).filter((r) => r.status === "completed")} />
      </section>
    </div>
  );
}
