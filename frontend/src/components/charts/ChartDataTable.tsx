import { formatNumber } from '@/utils/format';

import type { ChartSeries } from './chart-theme';

interface ChartDataTableProps<T> {
  data: readonly T[];
  categoryLabel: string;
  getCategory: (row: T) => string;
  series: readonly ChartSeries[];
  getValue: (row: T, key: string) => number;
  caption: string;
}

/** Accessible tabular fallback for any chart (always reachable without hover). */
export function ChartDataTable<T>({
  data,
  categoryLabel,
  getCategory,
  series,
  getValue,
  caption,
}: ChartDataTableProps<T>) {
  return (
    <div className="relative max-h-72 scrollbar-thin overflow-auto rounded-lg border">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-muted text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              {categoryLabel}
            </th>
            {series.map((item) => (
              <th key={item.key} scope="col" className="px-3 py-2 text-right font-medium">
                {item.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={`${getCategory(row)}-${index}`} className="border-t">
              <th scope="row" className="px-3 py-1.5 text-left font-normal">
                {getCategory(row)}
              </th>
              {series.map((item) => (
                <td key={item.key} className="px-3 py-1.5 text-right tabular-nums">
                  {formatNumber(getValue(row, item.key))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
