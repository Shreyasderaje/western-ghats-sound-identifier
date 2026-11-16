import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import type { Detection } from "../types";

/** Histogram of detections per confidence band (0.1-wide buckets). */
export default function ConfidenceChart({ detections }: { detections: Detection[] }) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    range: `${i * 10}-${i * 10 + 10}%`,
    count: detections.filter(
      (d) => d.confidence >= i / 10 && d.confidence < (i + 1) / 10
    ).length,
    tier: i < 4 ? "low" : i < 7 ? "medium" : "high",
  }));
  // Include any exact 1.0 scores in the last bucket.
  buckets[9].count += detections.filter((d) => d.confidence >= 1.0).length;

  const colors = { low: "#f87171", medium: "#fbbf24", high: "#34d399" } as const;

  return (
    <div className="card p-4">
      <h3 className="mb-1 font-semibold">Confidence distribution</h3>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        How many call events fall in each confidence band
      </p>
      <BarChart
        width={Math.min(720, typeof window !== "undefined" ? window.innerWidth - 80 : 640)}
        height={220}
        data={buckets}
        margin={{ top: 4, right: 8, left: -18 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
        <XAxis dataKey="range" tick={{ fontSize: 10 }} interval={0} angle={-35} dy={8} height={44} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {buckets.map((b, i) => (
            <Cell key={i} fill={colors[b.tier as keyof typeof colors]} />
          ))}
        </Bar>
      </BarChart>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
        <LegendDot color={colors.high} label="High (≥70%)" />
        <LegendDot color={colors.medium} label="Medium (40–69%)" />
        <LegendDot color={colors.low} label="Low (<40%)" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
