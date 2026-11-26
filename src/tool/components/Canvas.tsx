'use client';

import React from 'react';
import { ALIGNMENTS } from '../ui-shared';
import { convertHtmlToMarkdown } from '../types';
import type { ToolState } from '../types';

interface CanvasProps {
  state: ToolState;
  onChange?: (state: ToolState) => void;
}

const inputClass =
  'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

function CopyButton({ value, label, testid }: { value: string; label: string; testid?: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; ignore
    }
  }, [value]);
  return (
    <button
      type="button"
      onClick={handleCopy}
      data-testid={testid}
      className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
      aria-label={label}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export const Canvas: React.FC<CanvasProps> = ({ state, onChange }) => {
  const update = (patch: Partial<ToolState>) => onChange?.({ ...state, ...patch });
  const conversion = React.useMemo(
    () => convertHtmlToMarkdown(state.html, state.tableIndex, state),
    [
      state.html,
      state.tableIndex,
      state.alignment,
      state.trimCells,
      state.flattenSpans,
      state.escapePipes,
    ]
  );

  const reconvert = (patch: Partial<ToolState>) => {
    const next = { ...state, ...patch };
    const result = convertHtmlToMarkdown(next.html, next.tableIndex, next);
    update({
      ...patch,
      tableIndex: next.tableIndex,
      markdown: result.markdown,
      error: result.error,
    });
  };

  const handleHtmlInput = (html: string) => {
    const result = convertHtmlToMarkdown(html, 0, state);
    update({ html, tableIndex: 0, markdown: result.markdown, error: result.error });
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([state.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'table.md';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // download unavailable; ignore
    }
  };

  return (
    <div className="p-4 space-y-4" data-testid="converter-canvas">
      <div>
        <label
          className="block text-xs font-medium text-gray-700 dark:text-gray-300"
          htmlFor="html-input"
        >
          HTML input
        </label>
        <textarea
          id="html-input"
          data-testid="html-input"
          className={`${inputClass} font-mono`}
          rows={10}
          placeholder="<table><tr><th>Name</th><th>Value</th></tr><tr><td>A</td><td>1</td></tr></table>"
          value={state.html}
          onChange={(e) => handleHtmlInput(e.target.value)}
          spellCheck={false}
        />
      </div>

      {conversion.tables.length > 1 ? (
        <div data-testid="table-selector">
          <label
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            htmlFor="table-index"
          >
            Table ({conversion.tables.length} found)
          </label>
          <select
            id="table-index"
            data-testid="table-select"
            className={inputClass}
            value={state.tableIndex}
            onChange={(e) => reconvert({ tableIndex: Number.parseInt(e.target.value, 10) || 0 })}
          >
            {conversion.tables.map((_, index) => (
              <option key={index} value={index}>
                Table {index + 1}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <div>
          <label
            className="block text-xs font-medium text-gray-700 dark:text-gray-300"
            htmlFor="alignment"
          >
            Column alignment
          </label>
          <select
            id="alignment"
            data-testid="alignment-select"
            className={inputClass}
            value={state.alignment}
            onChange={(e) => reconvert({ alignment: e.target.value as ToolState['alignment'] })}
          >
            {ALIGNMENTS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            data-testid="trim-cells"
            checked={state.trimCells}
            onChange={(e) => reconvert({ trimCells: e.target.checked })}
          />
          Trim cells
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            data-testid="flatten-spans"
            checked={state.flattenSpans}
            onChange={(e) => reconvert({ flattenSpans: e.target.checked })}
          />
          Flatten colspan/rowspan
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            data-testid="escape-pipes"
            checked={state.escapePipes}
            onChange={(e) => reconvert({ escapePipes: e.target.checked })}
          />
          Escape pipes
        </label>
      </div>

      {conversion.error ? (
        <p
          className="rounded bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
          data-testid="error-banner"
        >
          {conversion.error}
        </p>
      ) : null}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label
            className="text-xs font-medium text-gray-700 dark:text-gray-300"
            htmlFor="markdown-output"
          >
            Markdown output
          </label>
          <div className="flex gap-2">
            <CopyButton value={state.markdown} label="Copy Markdown" testid="copy-markdown" />
            <button
              type="button"
              onClick={handleDownload}
              data-testid="download-markdown"
              className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Download Markdown"
            >
              Download .md
            </button>
          </div>
        </div>
        <textarea
          id="markdown-output"
          data-testid="markdown-output"
          className={`${inputClass} font-mono`}
          rows={10}
          value={state.markdown}
          onChange={(e) => update({ markdown: e.target.value })}
          spellCheck={false}
        />
      </div>

      <div>
        <h3 className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
          Rendered preview
        </h3>
        <MarkdownPreview markdown={state.markdown} />
      </div>
    </div>
  );
};

/** Minimal GFM-table preview: renders the first table block of the markdown. */
export const MarkdownPreview: React.FC<{ markdown: string }> = ({ markdown }) => {
  const table = React.useMemo(() => markdownToPreviewTable(markdown), [markdown]);
  if (!table) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400" data-testid="markdown-preview-empty">
        No table preview yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto" data-testid="markdown-preview">
      <table className="min-w-full border border-gray-300 text-left text-xs dark:border-gray-700">
        <thead>
          <tr>
            {table.header.map((cell, i) => (
              <th key={i} className="border-b border-gray-300 px-2 py-1 dark:border-gray-700">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className="border-b border-gray-200 px-2 py-1 dark:border-gray-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

interface PreviewTable {
  header: string[];
  rows: string[][];
}

/** Parse a markdown table block back into rows for the live preview. */
export function markdownToPreviewTable(markdown: string): PreviewTable | null {
  const lines = markdown.split('\n').filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return null;
  const splitRow = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split(/(?<!\\)\|/)
      .map((cell) => cell.replace(/\\\|/g, '|').trim());
  const header = splitRow(lines[0] ?? '');
  const body = lines.slice(2).map(splitRow);
  return { header, rows: body };
}
