import { walkHtml } from "../adapters/html";
import type { IR } from "../ir";

/**
 * Client-only: render untrusted HTML in a sandboxed, offscreen iframe and walk
 * its rendered DOM into the IR. No server rendering infra — this runs in the
 * user's browser, the same iframe pattern ScratchReveal already uses for the
 * redesign output.
 *
 * The measurement viewport width MUST match the width Results renders the
 * display iframe at, or the marker percentages drift. Both use MEASURE_WIDTH.
 */

/** Fixed render width for measurement + display (matches PhoneFrame). */
export const MEASURE_WIDTH = 390;

/** Lock the iframe down: block all network/script, allow only inline styles,
 *  data: images and data: fonts. Injected even though scripts can't run
 *  (no allow-scripts) — defence in depth against CSS/img exfiltration. */
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:;";

function withCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${CSP}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, `<head$1>${meta}`);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html([^>]*)>/i, `<html$1><head>${meta}</head>`);
  return `<!doctype html><html><head>${meta}<meta charset="utf-8"></head><body>${html}</body></html>`;
}

/** Wrap a bare CSS file into a minimal document so it renders/measures. */
export function cssToHtml(css: string): string {
  return `<!doctype html><html><head><style>${css}</style></head><body></body></html>`;
}

export async function extractIRFromHtml(html: string): Promise<IR> {
  if (typeof document === "undefined") throw new Error("extractIRFromHtml must run in the browser");

  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-same-origin"); // NO allow-scripts — never both
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: `${MEASURE_WIDTH}px`,
    height: "800px",
    border: "0",
    visibility: "hidden",
    pointerEvents: "none",
  } as CSSStyleDeclaration);

  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Rendering the HTML timed out.")), 8000);
      iframe.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
      iframe.srcdoc = withCsp(html);
    });

    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc || !doc.body) throw new Error("Could not read the rendered HTML.");

    // Let webfonts settle, then grow the iframe to full content height so
    // getBoundingClientRect returns whole-document coordinates (no scroll).
    try {
      await (doc as Document & { fonts?: { ready?: Promise<unknown> } }).fonts?.ready;
    } catch {
      /* fonts API unavailable — proceed */
    }
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const contentHeight = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 1);
    iframe.style.height = `${contentHeight}px`;
    await new Promise((r) => requestAnimationFrame(() => r(null)));

    const viewport = { w: MEASURE_WIDTH, h: Math.round(contentHeight) };
    return walkHtml(doc.body, win, viewport);
  } finally {
    iframe.remove();
  }
}
