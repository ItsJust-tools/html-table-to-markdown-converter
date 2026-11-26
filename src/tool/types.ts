export type Alignment = 'none' | 'left' | 'center' | 'right';

export interface TableData {
  /** Header row cells. */
  header: string[];
  /** Body rows; every row aligns with the column count. */
  rows: string[][];
}

export interface ToolState {
  /** Raw HTML input pasted by the user. */
  html: string;
  /** Zero-based index of the selected table when the input contains several. */
  tableIndex: number;
  /** Column alignment applied to the generated Markdown. */
  alignment: Alignment;
  /** Trim whitespace inside cells before conversion. */
  trimCells: boolean;
  /** Flatten colspan/rowspan by repeating cell content. */
  flattenSpans: boolean;
  /** Escape pipe characters in cell content. */
  escapePipes: boolean;
  /** Resulting Markdown output (kept in state so it is shareable/editable). */
  markdown: string;
  /** Error message from the last conversion or url import. */
  error: string;
}

export const DEFAULT_STATE: ToolState = {
  html: '',
  tableIndex: 0,
  alignment: 'none',
  trimCells: true,
  flattenSpans: true,
  escapePipes: true,
  markdown: '',
  error: '',
};

export const MAX_TABLES = 50;

const VALID_ALIGNMENTS: Alignment[] = ['none', 'left', 'center', 'right'];

export function isAlignment(value: unknown): value is Alignment {
  return VALID_ALIGNMENTS.includes(value as Alignment);
}

/** Escape characters that break GFM table cells. */
export function escapeCell(text: string, escapePipes: boolean): string {
  let out = text.replace(/\r?\n/g, ' ');
  if (escapePipes) {
    out = out.replace(/\|/g, '\\|');
  }
  return out;
}

/** Column alignment separator cells for the Markdown header divider. */
export function alignmentCell(alignment: Alignment): string {
  switch (alignment) {
    case 'left':
      return ':---';
    case 'center':
      return ':---:';
    case 'right':
      return '---:';
    default:
      return '---';
  }
}

/** Convert a parsed table into GitHub-flavored Markdown. */
export function tableToMarkdown(
  table: TableData,
  state: Pick<ToolState, 'alignment' | 'trimCells' | 'escapePipes'>
): string {
  const clean = (text: string): string => {
    const value = state.trimCells ? text.trim() : text;
    return escapeCell(value, state.escapePipes);
  };
  const header = table.header.map(clean);
  const rows = table.rows.map((row) => row.map(clean));
  const columnCount = Math.max(header.length, ...rows.map((row) => row.length), 1);
  const pad = (cells: string[]): string[] => {
    const copy = [...cells];
    while (copy.length < columnCount) copy.push('');
    return copy.slice(0, columnCount);
  };
  const headerPadded = pad(header);
  const divider = Array.from({ length: columnCount }, () => alignmentCell(state.alignment));
  const lines = [
    `| ${headerPadded.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...rows.map((row) => `| ${pad(row).join(' | ')} |`),
  ];
  return lines.join('\n');
}

/** Extract text content of an HTML fragment as it would appear in a cell. */
export function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

interface ParsedCell {
  text: string;
  colspan: number;
  rowspan: number;
}

function parseCellsFromRow(rowHtml: string, flattenSpans: boolean): ParsedCell[] {
  const cells: ParsedCell[] = [];
  const cellRe = /<(t[dh])\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = cellRe.exec(rowHtml)) !== null) {
    const attrs = match[2] ?? '';
    const colspan = flattenSpans ? readSpan(attrs, 'colspan') : 1;
    const rowspan = flattenSpans ? readSpan(attrs, 'rowspan') : 1;
    cells.push({ text: htmlToText(match[3] ?? ''), colspan, rowspan });
  }
  return cells;
}

function readSpan(attrs: string, name: 'colspan' | 'rowspan'): number {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']?(\\d+)`, 'i'));
  if (!m) return 1;
  const n = Number.parseInt(m[1] ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 1000) : 1;
}

/**
 * Parse the first N tables out of an HTML document.
 * Returns [] when the input contains no <table> element.
 */
export function parseHtmlTables(
  html: string,
  options: { flattenSpans: boolean } & { maxTables?: number }
): TableData[] {
  const maxTables = options.maxTables ?? MAX_TABLES;
  const tables: TableData[] = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRe.exec(html)) !== null && tables.length < maxTables) {
    const inner = tableMatch[1] ?? '';
    const captionMatch = inner.match(/<caption\b[^>]*>([\s\S]*?)<\/caption\s*>/i);
    let body = inner;
    if (captionMatch) {
      body = body.replace(captionMatch[0], '');
    }
    // Split into header and body sections; headerless tables use the first row.
    const theadMatch = body.match(/<thead\b[^>]*>([\s\S]*?)<\/thead\s*>/i);
    let headerCells: ParsedCell[] = [];
    let remaining = body;
    if (theadMatch) {
      headerCells = parseCellsFromRow(theadMatch[1] ?? '', options.flattenSpans);
      remaining = body.replace(theadMatch[0], '');
    }
    const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi;
    const bodyRows: ParsedCell[][] = [];
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(remaining)) !== null) {
      const cells = parseCellsFromRow(rowMatch[1] ?? '', options.flattenSpans);
      if (cells.length > 0) bodyRows.push(cells);
    }
    if (bodyRows.length === 0 && headerCells.length === 0) continue;
    if (headerCells.length === 0 && bodyRows.length > 0) {
      headerCells = bodyRows.shift() ?? [];
    }
    const header = expandSpans(headerCells, options.flattenSpans);
    const columnCount = Math.max(header.length, 1);
    const rows = bodyRows.map((cells) => {
      const expanded = expandSpans(cells, options.flattenSpans);
      const padded = [...expanded];
      while (padded.length < columnCount) padded.push('');
      return padded.slice(0, columnCount);
    });
    tables.push({ header, rows });
  }
  return tables;
}

function expandSpans(cells: ParsedCell[], flatten: boolean): string[] {
  const out: string[] = [];
  for (const cell of cells) {
    const colspan = flatten ? cell.colspan : 1;
    for (let i = 0; i < colspan; i++) out.push(cell.text);
  }
  return out;
}

/** Run the full pipeline: HTML -> tables -> markdown for the selected table. */
export function convertHtmlToMarkdown(
  html: string,
  tableIndex: number,
  options: Pick<ToolState, 'alignment' | 'trimCells' | 'flattenSpans' | 'escapePipes'>
): { tables: TableData[]; markdown: string; error: string } {
  const tables = parseHtmlTables(html, { flattenSpans: options.flattenSpans });
  if (tables.length === 0) {
    return { tables, markdown: '', error: 'No <table> element found in the input.' };
  }
  const index = Math.min(Math.max(tableIndex, 0), tables.length - 1);
  const selected = tables[index] ?? tables[0];
  const markdown = selected ? tableToMarkdown(selected, options) : '';
  return { tables, markdown, error: '' };
}
