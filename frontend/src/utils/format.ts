const numberFormatter = new Intl.NumberFormat();
const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** 1,284 → "1,284"; 12,900 → "12.9K". */
export function formatCompactNumber(value: number): string {
  return Math.abs(value) < 10_000 ? numberFormatter.format(value) : compactFormatter.format(value);
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB'] as const;

export function formatFileSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    FILE_SIZE_UNITS.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  const unit = FILE_SIZE_UNITS[exponent] ?? 'B';
  return `${value.toFixed(value < 10 && exponent > 0 ? 1 : 0)} ${unit}`;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
