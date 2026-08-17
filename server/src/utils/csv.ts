/**
 * Minimal RFC 4180 CSV writer. A field is quoted only when it contains a
 * comma, a double quote, or a line break; embedded quotes are escaped by
 * doubling them. Rows are joined with \r\n (the CSV-standard line ending),
 * distinct from newlines *inside* a field, which are preserved verbatim
 * inside the quoted field rather than being stripped or breaking the row.
 */
export function csvEscapeField(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const header = columns.map(csvEscapeField).join(',');
  const body = rows.map((row) => columns.map((c) => csvEscapeField(row[c])).join(','));
  return [header, ...body].join('\r\n');
}
