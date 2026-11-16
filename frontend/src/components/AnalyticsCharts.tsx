import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopSpecies, TrendPoint } from "../types";

export function TopSpeciesChart({ species }: { species: TopSpecies[] }) {
  const data = species.map((s) => ({
    name: s.species_name.length > 22 ? `${s.species_name.slice(0, 20)}…` : s.species_name,
    count: s.count,
  }));

  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No species detected yet.</p>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ borderRadius: 8, fontSize: 12 }}
            formatter={(value) => [`${value} detections`, ""]}
          />
          <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendsChart({ trends }: { trends: TrendPoint[] }) {
  if (trends.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No trend data yet.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={trends} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="detections" name="Detections" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
          <Bar dataKey="species" name="Unique species" fill="#10b981" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
