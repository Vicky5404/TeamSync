/** Cells starting with these characters are interpreted as formulas by spreadsheet apps. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Escape one CSV cell (RFC 4180) and neutralize spreadsheet formula injection
 * (CWE-1236) by prefixing risky values with a single quote.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function csvRow(values: Array<string | number | boolean | null | undefined>): string {
  return values.map(csvCell).join(',');
}

/** UTF-8 BOM so Excel detects the encoding. */
export const CSV_BOM = '﻿';
