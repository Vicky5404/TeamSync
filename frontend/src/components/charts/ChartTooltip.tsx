import type { ReactNode } from 'react';

import { formatNumber } from '@/utils/format';

export interface ChartTooltipRow {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface ChartTooltipProps {
  title: ReactNode;
  rows: readonly ChartTooltipRow[];
}

/** Tooltip body: values lead (strong), series names follow; keyed by a short line. */
export function ChartTooltip({ title, rows }: ChartTooltipProps) {
  return (
    <div className="min-w-36 rounded-lg border bg-surface-raised px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="font-semibold text-foreground tabular-nums">
              {formatNumber(row.value)}
            </span>
            <span className="text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
