# HTML Table to Markdown Converter

Paste HTML tables and convert them instantly into clean GitHub-flavored Markdown tables, with editable output and import from a file.

**Live:** [html-table-to-markdown-converter.itsjust.tools](https://html-table-to-markdown-converter.itsjust.tools)

## Features

- Paste or upload HTML and auto-detect all `<table>` elements
- Live conversion to GitHub-flavored Markdown with proper pipe escaping
- Support for colspan/rowspan flattening and header row detection
- Table selector when multiple tables exist in the input
- Copy to clipboard and download `.md` buttons
- Load HTML from a local file
- Format options: column alignment (`none`/`left`/`center`/`right`), cell trimming, pipe escaping
- Round-trip preview showing a rendered Markdown preview

## Usage

1. Paste HTML containing one or more tables into the input area, or click **Load file** to pick a local `.html` file.
2. Pick a table from the selector when several are detected.
3. Adjust the alignment and cell options; the Markdown output and preview update live.
4. Copy the result or download it as `table.md`.

## Keyboard shortcuts

| Key                    | Action      |
| ---------------------- | ----------- |
| `Ctrl/Cmd + Shift + C` | Copy result |
| `Ctrl/Cmd + S`         | Share URL   |

## Development

```bash
npm ci
npm run dev
npm test -- --coverage
npm run build
```

## License

MIT
