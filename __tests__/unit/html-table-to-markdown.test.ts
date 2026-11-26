import { describe, it, expect } from 'vitest';
import {
  escapeCell,
  alignmentCell,
  tableToMarkdown,
  htmlToText,
  parseHtmlTables,
  convertHtmlToMarkdown,
  DEFAULT_STATE,
  type TableData,
  type ToolState,
} from '@/tool/types';
import {
  deserializeState,
  serializeState,
  roundTrips,
  summaryText,
  parseTableCount,
  parseAllTables,
  htmlTableToMarkdownTool,
} from '@/tool/tool-definition';
import { markdownToPreviewTable } from '@/tool/components/Canvas';
import toolConfig from '@/tool/tool.config';

const state = (patch: Partial<ToolState> = {}): ToolState => ({ ...DEFAULT_STATE, ...patch });

const SAMPLE_HTML =
  '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Alice</td><td>30</td></tr><tr><td>Bob</td><td>40</td></tr></tbody></table>';

describe('escapeCell', () => {
  it('escapes pipes when enabled', () => {
    expect(escapeCell('a|b', true)).toBe('a\\|b');
  });
  it('keeps pipes when disabled', () => {
    expect(escapeCell('a|b', false)).toBe('a|b');
  });
  it('collapses newlines to spaces', () => {
    expect(escapeCell('a\nb', true)).toBe('a b');
  });
});

describe('alignmentCell', () => {
  it('maps alignments to GFM dividers', () => {
    expect(alignmentCell('none')).toBe('---');
    expect(alignmentCell('left')).toBe(':---');
    expect(alignmentCell('center')).toBe(':---:');
    expect(alignmentCell('right')).toBe('---:');
  });
});

describe('htmlToText', () => {
  it('strips tags and decodes common entities', () => {
    expect(htmlToText('<b>Bold</b> &amp; <i>nice</i>')).toBe('Bold & nice');
  });
  it('decodes lt/gt/quot/numeric apostrophe', () => {
    expect(htmlToText('&lt;x&gt; &quot;q&quot; &#39;a&#39;')).toBe(`<x> "q" 'a'`);
  });
  it('treats <br> and block closers as space characters', () => {
    expect(htmlToText('a b<br/>c')).toBe('a b c');
  });
  it('replaces br and closing p with a single space each', () => {
    expect(htmlToText('a<br>b<p>c</p>')).toBe('a bc ');
  });
});

describe('parseHtmlTables', () => {
  it('parses a thead/tbody table with header detection', () => {
    const tables = parseHtmlTables(SAMPLE_HTML, { flattenSpans: true });
    expect(tables).toHaveLength(1);
    expect(tables[0]?.header).toEqual(['Name', 'Age']);
    expect(tables[0]?.rows).toEqual([
      ['Alice', '30'],
      ['Bob', '40'],
    ]);
  });

  it('uses the first row as header when no thead exists', () => {
    const tables = parseHtmlTables(
      '<table><tr><td>H1</td><td>H2</td></tr><tr><td>a</td><td>b</td></tr></table>',
      { flattenSpans: true }
    );
    expect(tables[0]?.header).toEqual(['H1', 'H2']);
    expect(tables[0]?.rows).toEqual([['a', 'b']]);
  });

  it('returns [] for input without tables', () => {
    expect(parseHtmlTables('<p>no table</p>', { flattenSpans: true })).toEqual([]);
  });

  it('expands colspan when flattenSpans is on', () => {
    const tables = parseHtmlTables(
      '<table><tr><th colspan="2">Wide</th></tr><tr><td>a</td><td>b</td></tr></table>',
      { flattenSpans: true }
    );
    expect(tables[0]?.header).toEqual(['Wide', 'Wide']);
  });

  it('does not expand colspan when flattenSpans is off', () => {
    const tables = parseHtmlTables(
      '<table><tr><th colspan="2">Wide</th></tr><tr><td>a</td><td>b</td></tr></table>',
      { flattenSpans: false }
    );
    expect(tables[0]?.header).toEqual(['Wide']);
  });

  it('pads short rows to header column count', () => {
    const tables = parseHtmlTables(
      '<table><tr><th>A</th><th>B</th></tr><tr><td>only</td></tr></table>',
      { flattenSpans: true }
    );
    expect(tables[0]?.rows).toEqual([['only', '']]);
  });

  it('parses multiple tables in order', () => {
    const html = SAMPLE_HTML + '<table><tr><th>X</th></tr></table>';
    const tables = parseHtmlTables(html, { flattenSpans: true });
    expect(tables).toHaveLength(2);
    expect(tables[1]?.header).toEqual(['X']);
  });

  it('respects maxTables cap', () => {
    const html = SAMPLE_HTML + SAMPLE_HTML + SAMPLE_HTML;
    const tables = parseHtmlTables(html, { flattenSpans: true, maxTables: 2 });
    expect(tables).toHaveLength(2);
  });

  it('ignores rows without cells and tables without rows', () => {
    expect(parseHtmlTables('<table></table>', { flattenSpans: true })).toEqual([]);
  });
});

describe('tableToMarkdown', () => {
  const table: TableData = {
    header: ['A', 'B'],
    rows: [
      ['1', '2'],
      ['x|y', 'a<b'],
    ],
  };
  it('renders header, divider and body rows', () => {
    const md = tableToMarkdown(table, { alignment: 'none', trimCells: true, escapePipes: true });
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |\n| x\\|y | a<b |');
  });
  it('applies alignment dividers', () => {
    const md = tableToMarkdown(table, { alignment: 'center', trimCells: true, escapePipes: true });
    expect(md.split('\n')[1]).toBe('| :---: | :---: |');
  });
  it('pads missing columns', () => {
    const ragged: TableData = { header: ['A', 'B', 'C'], rows: [['1']] };
    const md = tableToMarkdown(ragged, { alignment: 'none', trimCells: true, escapePipes: true });
    expect(md.split('\n')[2]).toBe('| 1 |  |  |');
  });
  it('trims cells when trimCells is on', () => {
    const spaced: TableData = { header: ['  A  '], rows: [[' x ']] };
    const md = tableToMarkdown(spaced, { alignment: 'none', trimCells: true, escapePipes: true });
    expect(md.split('\n')[0]).toBe('| A |');
    expect(md.split('\n')[2]).toBe('| x |');
  });
  it('keeps whitespace when trimCells is off', () => {
    const spaced: TableData = { header: [' A '], rows: [] };
    const md = tableToMarkdown(spaced, { alignment: 'none', trimCells: false, escapePipes: true });
    expect(md.split('\n')[0]).toBe('|  A  |');
  });
});

describe('convertHtmlToMarkdown', () => {
  it('converts the selected table and clamps the index', () => {
    const result = convertHtmlToMarkdown(SAMPLE_HTML, 5, state());
    expect(result.error).toBe('');
    expect(result.tables).toHaveLength(1);
    expect(result.markdown).toContain('| Alice | 30 |');
  });
  it('reports an error when no table exists', () => {
    const result = convertHtmlToMarkdown('<div>nothing</div>', 0, state());
    expect(result.tables).toEqual([]);
    expect(result.markdown).toBe('');
    expect(result.error).toContain('No <table> element found');
  });
});

describe('serialize / deserialize', () => {
  it('serializes every field', () => {
    const s = serializeState(state({ html: SAMPLE_HTML, alignment: 'left', tableIndex: 2 }));
    expect(s).toContain('"alignment":"left"');
    expect(s).toContain('"tableIndex":2');
  });
  it('deserializes a valid payload and reconverts', () => {
    const result = deserializeState(JSON.parse(serializeState(state({ html: SAMPLE_HTML }))));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.markdown).toContain('| Alice | 30 |');
      expect(result.data.error).toBe('');
    }
  });
  it('rejects non-object payload', () => {
    expect(deserializeState('nope').success).toBe(false);
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState([]).success).toBe(false);
  });
  it('repairs invalid field types with defaults', () => {
    const result = deserializeState({ alignment: 'sideways', tableIndex: 99999, trimCells: 'yes' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.alignment).toBe('none');
      expect(result.data.tableIndex).toBe(0);
      expect(result.data.trimCells).toBe(true);
    }
  });
  it('round-trips without loss', () => {
    const converted = convertHtmlToMarkdown(SAMPLE_HTML, 0, {
      alignment: 'right',
      trimCells: true,
      flattenSpans: true,
      escapePipes: true,
    });
    const consistent = state({
      html: SAMPLE_HTML,
      alignment: 'right',
      markdown: converted.markdown,
    });
    expect(roundTrips(consistent)).toBe(true);
  });
});

describe('tool definition', () => {
  it('exposes the correct identity', () => {
    expect(htmlTableToMarkdownTool.id).toBe('html-table-to-markdown-converter');
    expect(htmlTableToMarkdownTool.name).toBe(toolConfig.name);
    expect(htmlTableToMarkdownTool.initialState).toEqual(DEFAULT_STATE);
    expect(htmlTableToMarkdownTool.exporters).toHaveLength(4);
  });
  it('counts tables', () => {
    expect(parseTableCount(SAMPLE_HTML + SAMPLE_HTML)).toBe(2);
    expect(parseTableCount('')).toBe(0);
  });
  it('builds summary text', () => {
    expect(summaryText(state())).toBe('No tables detected');
    expect(summaryText(state({ html: SAMPLE_HTML, markdown: '| A | B |' }))).toContain('1/1');
  });
  it('parses all tables via parseAllTables', () => {
    const tables = parseAllTables(state({ html: SAMPLE_HTML + SAMPLE_HTML }));
    expect(tables).toHaveLength(2);
  });
});

describe('markdown preview', () => {
  it('splits markdown table rows back into cells', () => {
    const preview = markdownToPreviewTable('| A | B |\n| --- | --- |\n| 1 | 2 |');
    expect(preview?.header).toEqual(['A', 'B']);
    expect(preview?.rows).toEqual([['1', '2']]);
  });
  it('unescapes escaped pipes', () => {
    const preview = markdownToPreviewTable('| A |\n| --- |\n| a\\|b |');
    expect(preview?.rows).toEqual([['a|b']]);
  });
  it('returns null for non-table markdown', () => {
    expect(markdownToPreviewTable('plain text')).toBeNull();
    expect(markdownToPreviewTable('')).toBeNull();
  });
});
