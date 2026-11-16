import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Clock, FileSpreadsheet, FileText, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import ConfidenceChart from "../components/ConfidenceChart";
import { QualityBadge } from "../components/ConfidenceBadge";
import DetectionTimeline from "../components/DetectionTimeline";
import { EmptyState } from "../components/ErrorAlert";
import { LoadingSpinner } from "../components/Loading";
import SpeciesTable, { fmt } from "../components/SpeciesTable";
import SpectrogramViewer from "../components/SpectrogramViewer";
import { useProcessing, useReports, useResults, useShareToggle } from "../hooks/useApi";
import { getSpectrogramUrl } from "../services/api";

export default function Results() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const results = useResults(fileId ?? null);
  const processing = useProcessing(fileId ?? null);
  const reports = useReports(fileId ?? "");
  const share = useShareToggle();

  const [threshold, setThreshold] = useState(0.15);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  const data = results.data?.results ?? null;
  const detections = data?.detections ?? [];

  // All hooks run unconditionally, before any early returns below.
  const filteredDetections = useMemo(
    () =>
      detections.filter(
        (d) => d.confidence >= threshold && (!selectedSpecies || d.species_name === selectedSpecies)
      ),
    [detections, threshold, selectedSpecies]
  );

  // Kick off processing automatically when a fresh upload lands here.
  const [autoStarted, setAutoStarted] = useState<string | null>(null);
  useEffect(() => {
    if (!fileId || autoStarted === fileId) return;
    const status = results.data?.status;
    if (status === "not_started" || status === "in_queue" || status === "processing") {
      if (status === "not_started" && !processing.start.isPending) {
        setAutoStarted(fileId);
        processing.start.mutate(undefined);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, results.data?.status]);

  // Poll status endpoint while a job is in flight so the page flips itself
  // out of the "processing" view without a manual refresh.
  useEffect(() => {
    if (processing.job && ["in_queue", "processing"].includes(processing.job.status)) {
      const timer = setInterval(() => {
        processing.refetch();
        results.refetch();
      }, 2500);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processing.job?.status]);

  const applyThreshold = useCallback(() => {
    if (!fileId) return;
    processing.start.mutate(threshold, {
      onSuccess: () => toast.success("Re-analyzing with the new threshold"),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, threshold]);

  // --- render (early returns after all hooks) ------------------------------

  if (results.isLoading) return <LoadingSpinner label="Loading results…" />;

  if (results.isError) {
    return (
      <EmptyState
        icon="🌧️"
        title="Couldn't load this recording"
        hint={(results.error as Error).message}
        action={
          <Link to="/analyze" className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white">
            Upload another
          </Link>
        }
      />
    );
  }

  const status = results.data?.status ?? "not_started";

  if (status === "in_queue" || status === "processing") {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto mb-4 block h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <h1 className="text-xl font-semibold">Analysis in progress…</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Status: <span className="font-medium capitalize">{status}</span>. A 5-minute
          recording usually takes under a minute. This page updates automatically.
        </p>
        <button
          onClick={() => {
            processing.refetch();
            results.refetch();
          }}
          className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Refresh now
        </button>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <EmptyState
        icon="⚠️"
        title="Analysis failed"
        hint={processing.job?.error_message ?? "The backend could not process this file."}
        action={
          <button
            onClick={() => processing.start.mutate(undefined)}
            className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white"
          >
            Try again
          </button>
        }
      />
    );
  }

  if (!data) return <EmptyState icon="🔍" title="Recording not found" />;

  const filteredSpecies = data.summary.per_species.filter(
    (s) => s.avg_confidence >= threshold || selectedSpecies === s.species_name
  );
  const recording = data.recording;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{recording.filename}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            {recording.upload_date && (
              <span>{new Date(recording.upload_date).toLocaleString()}</span>
            )}
            {recording.duration != null && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> {fmt(recording.duration)}
              </span>
            )}
            {recording.location && <span>📍 {recording.location}</span>}
            {data.quality && (
              <QualityBadge label={data.quality.label} score={data.quality.score} />
            )}
            {processing.job?.processing_time != null && (
              <span>analyzed in {processing.job.processing_time}s</span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={reports.pdf}
            disabled={reports.busy !== null || detections.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            <FileText className="h-4 w-4" /> {reports.busy === "pdf" ? "Generating…" : "PDF report"}
          </button>
          <button
            onClick={reports.csv}
            disabled={reports.busy !== null || detections.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="h-4 w-4" /> {reports.busy === "csv" ? "Generating…" : "CSV export"}
          </button>
          <button
            onClick={() => share.mutate({ fileId: fileId!, isPublic: !recording.is_public })}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium ${
              recording.is_public
                ? "border-primary-300 bg-primary-50 text-primary-700 dark:border-primary-800 dark:bg-primary-950/40 dark:text-primary-300"
                : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            }`}
          >
            <Share2 className="h-4 w-4" /> {recording.is_public ? "Shared" : "Share"}
          </button>
          <button
            onClick={() => navigate("/analyze")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <RotateCcw className="h-4 w-4" /> New analysis
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="Species detected" value={data.summary.unique_species} />
        <SummaryCard label="Call events" value={data.summary.total_detections} />
        <SummaryCard label="Birds / Frogs" value={`${data.summary.birds} / ${data.summary.frogs}`} />
        <SummaryCard
          label="Diversity (Shannon)"
          value={data.summary.shannon_diversity.toFixed(2)}
          hint={diversityWord(data.summary.shannon_diversity)}
        />
      </div>

      {data.quality && data.quality.label === "poor" && (
        <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          ⚠️ This recording has poor audio quality — detections may be unreliable.
          Clearer, closer recordings produce much better results.
        </p>
      )}

      {/* Threshold slider */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label htmlFor="threshold" className="text-sm font-medium">
            Confidence threshold:{" "}
            <span className="tabular-nums text-primary-600 dark:text-primary-400">
              {(threshold * 100).toFixed(0)}%
            </span>
          </label>
          <input
            id="threshold"
            type="range"
            min={5}
            max={90}
            step={5}
            value={threshold * 100}
            onChange={(e) => setThreshold(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-primary-600"
          />
          <p className="text-xs text-slate-400">
            Preview filters instantly · “Re-analyze” re-runs the model server-side
          </p>
        </div>
        <button
          onClick={applyThreshold}
          disabled={processing.start.isPending}
          className="shrink-0 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 disabled:opacity-60 dark:bg-slate-200 dark:text-slate-900"
        >
          {processing.start.isPending ? "Re-analyzing…" : "Re-analyze at this threshold"}
        </button>
        {selectedSpecies && (
          <button
            onClick={() => setSelectedSpecies(null)}
            className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
          >
            Clear filter: {selectedSpecies}
          </button>
        )}
      </div>

      {/* Spectrogram */}
      <SpectrogramViewer
        spectrogramUrl={getSpectrogramUrl(fileId!)}
        detections={filteredDetections}
        duration={recording.duration}
      />

      {/* Timeline */}
      <section className="card p-4">
        <h2 className="mb-4 font-semibold">Detection timeline</h2>
        <DetectionTimeline
          detections={filteredDetections}
          duration={recording.duration}
          selectedSpecies={selectedSpecies}
          onSelectSpecies={setSelectedSpecies}
        />
      </section>

      {/* Species table */}
      <section className="space-y-3">
        <h2 className="font-semibold">Species breakdown</h2>
        <SpeciesTable
          perSpecies={filteredSpecies}
          detections={detections}
          selectedSpecies={selectedSpecies}
          onSelectSpecies={setSelectedSpecies}
        />
      </section>

      {/* Confidence distribution */}
      <ConfidenceChart detections={detections} />

      <p className="pb-4 text-center text-xs text-slate-400">
        Species identifications are AI-assisted estimates based on generic audio
        classification and call-frequency heuristics — verify before research use.
      </p>
    </div>
  );
}

function diversityWord(shannon: number): string {
  if (shannon >= 1.5) return "high";
  if (shannon >= 0.7) return "moderate";
  return "low";
}

function SummaryCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="text-xs capitalize text-slate-400">{hint} diversity</p>}
    </div>
  );
}
