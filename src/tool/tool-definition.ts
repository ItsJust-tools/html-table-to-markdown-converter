import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import {
  DEFAULT_STATE,
  MAX_TABLES,
  convertHtmlToMarkdown,
  isAlignment,
  type Alignment,
  type TableData,
  type ToolState,
} from './types';

/** Serialize tool state into a compact JSON string for share/import. */
export function serializeState(state: ToolState): string {
  return JSON.stringify({
    html: state.html,
    tableIndex: state.tableIndex,
    alignment: state.alignment,
    trimCells: state.trimCells,
    flattenSpans: state.flattenSpans,
    escapePipes: state.escapePipes,
    markdown: state.markdown,
    error: state.error,
  });
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function indexOr(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const int = Math.trunc(value);
    if (int >= 0 && int < MAX_TABLES) return int;
  }
  return fallback;
}

/** Validate and recover tool state from an arbitrary payload. */
export function deserializeState(data: unknown): DeserializeResult<ToolState> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {
      success: false,
      error: 'Invalid data format: expected HTML table to Markdown converter state object',
    };
  }
  const v = data as Record<string, unknown>;
  const alignment: Alignment = isAlignment(v.alignment) ? v.alignment : DEFAULT_STATE.alignment;
  const tableIndex = indexOr(v.tableIndex, DEFAULT_STATE.tableIndex);
  const state: ToolState = {
    html: stringOr(v.html, ''),
    tableIndex,
    alignment,
    trimCells: boolOr(v.trimCells, DEFAULT_STATE.trimCells),
    flattenSpans: boolOr(v.flattenSpans, DEFAULT_STATE.flattenSpans),
    escapePipes: boolOr(v.escapePipes, DEFAULT_STATE.escapePipes),
    markdown: stringOr(v.markdown, ''),
    error: stringOr(v.error, ''),
  };
  // Re-run the conversion so the restored state is consistent with its options.
  const converted = convertHtmlToMarkdown(state.html, state.tableIndex, state);
  if (converted.tables.length === 0 && state.html.trim() === '') {
    // Empty input is a valid idle state, not an error.
    return { success: true, data: { ...state, error: '' } };
  }
  const repaired: ToolState = {
    ...state,
    tableIndex:
      converted.tables.length === 0
        ? state.tableIndex
        : Math.min(state.tableIndex, converted.tables.length - 1),
    markdown: converted.markdown,
    error: converted.error,
  };
  return { success: true, data: repaired };
}

/** True when a serialized string round-trips back to the same state. */
export function roundTrips(state: ToolState): boolean {
  try {
    const restored = deserializeState(JSON.parse(serializeState(state)));
    return restored.success && JSON.stringify(restored.data) === JSON.stringify(state);
  } catch {
    return false;
  }
}

/** Build a short history/summary line for the current state. */
export function summaryText(state: ToolState): string {
  const tables = parseTableCount(state.html);
  if (tables === 0) return 'No tables detected';
  if (state.markdown) {
    const lines = state.markdown.split('\n').length;
    return `Table ${state.tableIndex + 1}/${tables} · ${lines} lines of Markdown`;
  }
  return `${tables} table${tables === 1 ? '' : 's'} detected`;
}

/** Number of tables in the raw HTML (capped at MAX_TABLES). */
export function parseTableCount(html: string): number {
  const matches = html.match(/<table\b/gi);
  if (!matches) return 0;
  return Math.min(matches.length, MAX_TABLES);
}

/** Parse all tables of the current HTML input. */
export function parseAllTables(state: ToolState): TableData[] {
  return convertHtmlToMarkdown(state.html, state.tableIndex, state).tables;
}

export const htmlTableToMarkdownTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: { ...DEFAULT_STATE },
  serialize: serializeState,
  deserialize: deserializeState,
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};
