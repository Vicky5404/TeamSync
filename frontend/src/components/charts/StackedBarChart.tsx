import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts';

import {
  AXIS_TICK,
  GRID_STROKE,
  MAX_BAR_SIZE,
  SURFACE,
  seriesColor,
  type ChartSeries,
} from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

const seriesKey = (series: ChartSeries): string => series.key;

interface StackedBarChartProps<T extends object> {
  data: readonly T[];
  categoryKey: keyof T & string;
  series: ReadonlyArray<ChartSeries<keyof T & string>>;
  ariaLabel: string;
  /** Row height per category for the horizontal layout. */
  rowHeight?: number;
}

/**
 * Horizontal stacked bars (one row per category). Segments are separated by a
 * 2px surface gap; only the data end of the stack is rounded.
 */
export function StackedBarChart<T extends object>({
  data,
  categoryKey,
  series,
  ariaLabel,
  rowHeight = 40,
}: StackedBarChartProps<T>) {
  // Recharts types dataKey loosely; widen the typed key once here.
  const categoryDataKey: string = categoryKey;
  const height = Math.max(120, data.length * rowHeight + 32);

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltip
        title={String(label)}
        rows={series.map((item, index) => {
          const entry = payload.find((point) => point.dataKey === item.key);
          return {
            key: item.key,
            label: item.label,
            value: Number(entry?.value ?? 0),
            color: seriesColor(item, index),
          };
        })}
      />
    );
  };

  return (
    <figure className="space-y-3">
      <ChartLegend series={series} mark="square" />
      <div role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as unknown as Array<Record<string, unknown>>}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid horizontal={false} stroke={GRID_STROKE} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey={categoryDataKey}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={112}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
              isAnimationActive={false}
            />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={seriesKey(item)}
                name={item.label}
                stackId="stack"
                fill={seriesColor(item, index)}
                stroke={SURFACE}
                strokeWidth={2}
                maxBarSize={MAX_BAR_SIZE}
                radius={index === series.length - 1 ? [0, 4, 4, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
