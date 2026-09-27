import { cn } from '@/lib/cn';

import { seriesColor, type ChartSeries } from './chart-theme';

interface ChartLegendProps {
  series: readonly ChartSeries[];
  /** Legend key mirrors the mark: a line for line charts, a square for bars. */
  mark: 'line' | 'square';
  className?: string;
}

export function ChartLegend({ series, mark, className }: ChartLegendProps) {
  if (series.length < 2) return null;
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {series.map((item, index) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden="true"
            className={cn(mark === 'line' ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-[3px]')}
            style={{ backgroundColor: seriesColor(item, index) }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
