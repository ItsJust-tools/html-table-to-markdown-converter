'use client';

import React from 'react';
import type { ToolState } from '../types';

// File loading in the Toolbar needs to update tool state; the tool client
// registers a callback here (module-scoped so Toolbar's file input can use it).
let htmlLoader: ((html: string) => void) | null = null;
export function registerFileLoader(loader: (html: string) => void): void {
  htmlLoader = loader;
}
export function loadHtml(html: string): void {
  htmlLoader?.(html);
}

interface SidebarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ state }) => {
  const tableCount = React.useMemo(() => {
    const matches = state.html.match(/<table\b/gi);
    return matches ? matches.length : 0;
  }, [state.html]);
  const isEmpty = state.markdown.trim().length === 0;
  return (
    <div className="p-4 space-y-6 text-sm overflow-y-auto h-full" data-testid="converter-sidebar">
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Detected tables</h3>
        <p
          className="text-xs text-gray-600 dark:text-gray-300"
          data-testid="sidebar-table-count"
          data-count={tableCount}
        >
          {tableCount} table{tableCount === 1 ? '' : 's'} detected
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Conversion status</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300" data-testid="sidebar-status">
          {isEmpty
            ? 'Awaiting HTML input to convert.'
            : 'Markdown generated — copy or download it below the input.'}
        </p>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Options reference</h3>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
          <li>
            <strong>Trim cells</strong> — removes surrounding whitespace inside each cell.
          </li>
          <li>
            <strong>Flatten colspan/rowspan</strong> — repeats cell content across the spanned
            columns so the table keeps its shape.
          </li>
          <li>
            <strong>Escape pipes</strong> — escapes <code>|</code> characters so they do not break
            the Markdown table.
          </li>
        </ul>
      </div>
      <div>
        <h3 className="mb-2 font-medium text-gray-900 dark:text-gray-100">Share</h3>
        <p className="text-xs text-gray-600 dark:text-gray-300">
          The toolbar share button copies a URL that contains the HTML input and all options;
          opening it restores this conversion.
        </p>
      </div>
    </div>
  );
};
