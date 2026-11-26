import type { ToolConfig, ExportFormat, FeatureFlags } from '@itsjust/core';

const features: FeatureFlags = {
  export: true,
  autoSave: true,
  undoRedo: true,
  sidebar: true,
  statusBar: true,
  darkMode: true,
};

const toolConfig: ToolConfig = {
  id: 'html-table-to-markdown-converter',
  name: 'HTML Table to Markdown Converter',
  version: '1.0.0',
  description:
    'Paste HTML tables and convert them instantly into clean GitHub-flavored Markdown tables, with editable output and import from URL or file.',
  exportFormats: ['json'] as ExportFormat[],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: { brand: 'HTML Table to Markdown Converter' },
};

export default toolConfig;
