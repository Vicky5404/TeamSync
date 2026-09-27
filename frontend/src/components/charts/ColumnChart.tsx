import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
  type TooltipValueType,
} from 'recharts';

import { AXIS_TICK, GRID_STROKE, MAX_BAR_SIZE, SERIES_COLORS } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

export interface ColumnDatum {
  label: string;
  value: number;
}

interface ColumnChartProps {
  data: readonly ColumnDatum[];
  valueLabel: string;
  ariaLabel: string;
  height?: number;
}

/** Single-series column chart (one color, value labels on the caps). */
export function ColumnChart({ data, valueLabel, ariaLabel, height = 220 }: ColumnChartProps) {
  const color = SERIES_COLORS[0];

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps<TooltipValueType, string | number>) => {
    if (!active || !payload?.length) return null;
    return (
      <ChartTooltip
        title={String(label)}
        rows={[{ key: 'value', label: valueLabel, value: Number(payload[0]?.value ?? 0), color }]}
      />
    );
  };

  return (
    <div role="img" aria-label={ariaLabel} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
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
            cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
            isAnimationActive={false}
          />
          <Bar
            dataKey="value"
            name={valueLabel}
            fill={color}
            maxBarSize={MAX_BAR_SIZE}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="top"
              offset={6}
              style={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
