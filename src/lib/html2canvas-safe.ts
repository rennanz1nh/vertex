import html2canvas from "html2canvas";

/**
 * html2canvas 1.4 throws "unsupported color function oklch" on Tailwind v4 stylesheets,
 * which it parses for every element of the cloned page. Our PDF templates are styled
 * entirely inline, so the clone drops the page's stylesheets before rendering.
 */
export function renderToCanvas(node: HTMLElement, options: Parameters<typeof html2canvas>[1] = {}) {
  return html2canvas(node, {
    ...options,
    onclone: (doc, el) => {
      doc.querySelectorAll('style, link[rel="stylesheet"]').forEach((s) => s.remove());
      options?.onclone?.(doc, el);
    },
  });
}
