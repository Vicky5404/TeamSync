/** "Acme Inc." → "acme-inc" */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

/** Suggest a short project key from a name: "Website Redesign" → "WR", "Payments" → "PAY". */
export function suggestProjectKey(name: string): string {
  const words = name
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return (words[0] ?? '').slice(0, 3).toUpperCase();
  return words
    .slice(0, 4)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
