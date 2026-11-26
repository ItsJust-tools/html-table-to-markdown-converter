'use client';

import React from 'react';
import type { ToolState } from '../types';

interface ToolbarProps {
  state: ToolState;
  onChange: (next: ToolState) => void;
  onClear: () => void;
  onCopy?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ onChange, onClear, onCopy }) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2" role="group" aria-label="Converter tool controls">
        <button
          type="button"
          onClick={onClear}
          data-testid="btn-clear"
          className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Clear
        </button>
        <label
          className="cursor-pointer rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          data-testid="btn-load-file"
        >
          Load file
          <input
            type="file"
            accept=".html,.htm,.xhtml,text/html"
            className="hidden"
            data-testid="file-input"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => onChangeState(String(reader.result ?? ''));
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
        </label>
        {onCopy ? (
          <button
            type="button"
            onClick={onCopy}
            data-testid="btn-copy-result"
            className="rounded-md bg-violet-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-600"
          >
            Copy result
          </button>
        ) : null}
      </div>
    </div>
  );
};

// Local helper so the file input handler can call back through props.
let onChangeStateExternal: (html: string) => void = () => {};
function onChangeState(html: string) {
  onChangeStateExternal(html);
}
export function registerHtmlLoader(callback: (html: string) => void) {
  onChangeStateExternal = callback;
}
// Keep React import used for the FC typing side-effect.
export const __toolbarElement = React;
