import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
}

export default function StatisticsCard({ icon, label, value, hint }: Props) {
  return (
    <div className="card flex items-center gap-4 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {label}
        </p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {hint && <p className="truncate text-xs text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}
