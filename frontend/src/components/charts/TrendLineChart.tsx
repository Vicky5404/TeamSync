import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts';

import { AXIS_TICK, GRID_STROKE, SURFACE, seriesColor, type ChartSeries } from './chart-theme';
import { ChartLegend } from './ChartLegend';
import { ChartTooltip } from './ChartTooltip';

const seriesKey = (series: ChartSeries): string => series.key;

interface TrendLineChartProps<T extends object> {
  data: readonly T[];
  xKey: keyof T & string;
  series: ReadonlyArray<ChartSeries<keyof T & string>>;
  formatX: (value: string) => string;
  height?: number;
  ariaLabel: string;
}

/** Multi-series line chart with crosshair tooltip listing every series. */
export function TrendLineChart<T extends object>({
  data,
  xKey,
  series,
  formatX,
  height = 260,
  ariaLabel,
}: TrendLineChartProps<T>) {
  // Recharts types dataKey loosely; widen the typed key once here.
  const xDataKey: string = xKey;
  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltip
        title={formatX(String(label))}
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
      <ChartLegend series={series} mark="line" />
      <div role="img" aria-label={ariaLabel} style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data as unknown as Array<Record<string, unknown>>}
            margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
          >
            <CartesianGrid vertical={false} stroke={GRID_STROKE} />
            <XAxis
              dataKey={xDataKey}
              tickFormatter={(value: string) => formatX(value)}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              allowDecimals={false}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: 'var(--chart-cursor)', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {series.map((item, index) => (
              <Line
                key={item.key}
                type="linear"
                dataKey={seriesKey(item)}
                name={item.label}
                stroke={seriesColor(item, index)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, stroke: SURFACE, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
