/**
 * Chart tokens. Categorical slots are assigned in this fixed order and never
 * cycled; colors live in CSS variables so light/dark themes swap automatically.
 * (Validated for CVD separation in both themes — see src/index.css.)
 */
export const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'] as const;

export interface ChartSeries<K extends string = string> {
  key: K;
  label: string;
  /** Explicit color; defaults to the categorical slot for the series index. */
  color?: string;
}

export function seriesColor(series: ChartSeries, index: number): string {
  return series.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? 'var(--chart-1)';
}

export const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 12 } as const;
export const GRID_STROKE = 'var(--chart-grid)';
export const SURFACE = 'var(--surface)';

/** Max bar thickness; bars never fill the whole band. */
export const MAX_BAR_SIZE = 24;
