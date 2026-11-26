import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import ToolPage from '@/app/page';
import { JsonLd } from '@/app/json-ld';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { generateToolMetadata, generateJsonLd } from '@/lib/seo';
import { cn } from '@/lib/utils';
import toolConfig from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { htmlTableToMarkdownTool } from '@/tool/tool-definition';
import { Canvas } from '@/tool/components/Canvas';
import { Sidebar } from '@/tool/components/Sidebar';
import { Toolbar } from '@/tool/components/Toolbar';
import { DEFAULT_STATE as BASE_DEFAULT_STATE } from '@/tool/types';

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

type ExporterLoader = () => Promise<{
  default?: { format: string };
  exporter?: { format: string };
}>;

const getOgImageUrl = (images: unknown): string | undefined => {
  const first = Array.isArray(images) ? images[0] : undefined;
  if (!first) return undefined;
  if (typeof first === 'string') return first;
  if (first instanceof URL) return first.toString();
  return String(first.url);
};

describe('app and seo', () => {
  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();

    expect(man.name).toBe(templateMetadata.appName);
    expect(rob.sitemap).toBe('http://localhost:3000/sitemap.xml');
    expect(sm[0]?.url).toBe('http://localhost:3000');
  });

  it('renders json-ld script safely', () => {
    render(<JsonLd config={{ ...toolConfig, name: '</script>' }} />);
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script?.innerHTML).toContain('\\u003c/script>');
  });

  it('renders error page and invokes reset', () => {
    const reset = vi.fn();
    render(<ErrorPage error={new Error('boom')} reset={reset} />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders not-found page', () => {
    render(<NotFound />);
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go home' })).toHaveAttribute('href', '/');
  });

  it('renders top-level tool page', () => {
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
    expect(document.querySelector('script[type="application/ld+json"]')).toBeInTheDocument();
  });

  it('covers tool definition and helper exports', async () => {
    expect(cn('a', undefined, 'b', false, null, 'c')).toBe('a b c');
    expect(getPublicSiteUrl()).toBe('http://localhost:3000');
    expect(htmlTableToMarkdownTool.name).toBe(toolConfig.name);
    const restored = htmlTableToMarkdownTool.deserialize({
      html: '<table><tr><th>A</th></tr></table>',
      unknown: true,
    });
    expect(restored.success).toBe(true);
    if (restored.success) {
      expect(restored.data.markdown).toContain('| A |');
      expect(restored.data.alignment).toBe(BASE_DEFAULT_STATE.alignment);
    }
    const repaired = htmlTableToMarkdownTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.markdown).toBe('');
      expect(repaired.data.error).toBe('');
    }
    expect(
      htmlTableToMarkdownTool.serialize({
        ...BASE_DEFAULT_STATE,
        html: '<table><tr><td>x</td></tr></table>',
      })
    ).toContain('"html"');
    const exporters =
      (htmlTableToMarkdownTool as { exporters?: Array<{ loader: ExporterLoader }> }).exporters ??
      [];
    expect(exporters).toHaveLength(4);
    const first = exporters[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing exporter');
    const png = await (first.loader as ExporterLoader)();
    const resolved = 'default' in png ? png.default : png.exporter;
    expect(resolved?.format).toBe('png');
  });

  it('renders tool components', () => {
    render(
      <>
        <Toolbar
          state={{ ...BASE_DEFAULT_STATE }}
          onChange={() => {}}
          onClear={() => {}}
          onCopy={() => {}}
        />
        <Sidebar state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />
        <Canvas state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />
      </>
    );

    expect(screen.getByTestId('html-input')).toBeInTheDocument();
    expect(screen.getByTestId('markdown-output')).toBeInTheDocument();
    expect(screen.getByTestId('converter-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('btn-clear')).toBeInTheDocument();
  });
});
