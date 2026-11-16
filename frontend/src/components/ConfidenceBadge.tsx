import type { QualityLabel } from "../types";

/** Color-coded confidence badge: red < 0.4, amber < 0.7, green >= 0.7. */
export function confidenceTier(confidence: number): "low" | "medium" | "high" {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.4) return "medium";
  return "low";
}

const TIERS = {
  high: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  low: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tier = confidenceTier(confidence);
  const label = tier === "high" ? "High" : tier === "medium" ? "Medium" : "Low";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TIERS[tier]}`}
      title={`${(confidence * 100).toFixed(0)}% confidence`}
    >
      {label} · {(confidence * 100).toFixed(0)}%
    </span>
  );
}

const QUALITY_STYLES: Record<QualityLabel, string> = {
  excellent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  good: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  fair: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  poor: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export function QualityBadge({ label, score }: { label: QualityLabel; score?: number }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${QUALITY_STYLES[label]}`}
      title={score != null ? `Quality score ${score}/100` : undefined}
    >
      {label} quality{score != null ? ` · ${Math.round(score)}/100` : ""}
    </span>
  );
}
