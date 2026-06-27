/**
 * 03 — Absolute PDF Spans → Responsive Reflow
 *
 * A common real task: you have static, absolute-positioned content (e.g. text
 * spans extracted from a PDF by pdf.js, each with an x/width in page units)
 * and you want it to reflow responsively. The trick is to convert each span's
 * absolute x/w into PERCENTAGE columns, hand them to Boxwood, and let the
 * engine re-resolve at any width.
 *
 * Shrink the panel: the two-column body narrows and the paragraphs rewrap into
 * more and more lines — a live CSS-style column reflow driven entirely by the
 * percentage columns we derived once, up front, from the original PDF geometry.
 */

import { resolveLayout, defaultMeasure } from "../index.js";
import type { LNode } from "../types.js";
import { mountScene, svg, card, type Viewport } from "./shell.js";

const measure = (text: string, fontSize = 14) => (avail: { w: number }) =>
  defaultMeasure(text, { fontSize }, avail.w);

// Imagine these came from pdf.js: absolute x + width on a 612pt-wide page.
const PAGE_W = 612;
const SPANS = [
  { id: "title", x: 56, w: 500, text: "Quarterly Field Report", size: 20 },
  { id: "col-left", x: 56, w: 240, text: "The northern transect showed a marked increase in canopy density compared to the prior survey, consistent with the wetter season and reduced grazing pressure across the lower slopes." },
  { id: "col-right", x: 320, w: 236, text: "Soil samples returned higher nitrogen than expected; we attribute this to the cover-crop rotation begun last spring, which appears to be establishing well despite the late frost." },
];

/** Convert an absolute x/width (in page units) into a percentage of page width. */
const pct = (v: number): `${number}%` => `${(v / PAGE_W) * 100}%`;

function buildTree(): LNode {
  return {
    style: { padding: 20 },
    // A fixed title band, then the body fills the rest of the height.
    split: { rows: [64, "auto"], gap: 16 },
    children: [
      { id: "title", style: { padding: 12 }, measure: measure(SPANS[0].text, 20) },
      {
        // Two columns whose widths come straight from the PDF span geometry,
        // expressed as percentages so they scale with the viewport. The gap is
        // the original inter-column space (320 − (56 + 240)), also as a %.
        style: { w: "100%", h: "100%" },
        split: { cols: [pct(SPANS[1].w), pct(SPANS[2].w)], gap: pct(320 - (56 + 240)) },
        children: [
          // h: "100%" lets each column fill the body; as the panel narrows the
          // text simply rewraps into more lines within the same column.
          { id: "col-left", style: { padding: 12, h: "100%" }, measure: measure(SPANS[1].text, 13) },
          { id: "col-right", style: { padding: 12, h: "100%" }, measure: measure(SPANS[2].text, 13) },
        ],
      },
    ],
  };
}

function buildScene({ w, h }: Viewport): string {
  const { boxes } = resolveLayout(buildTree(), { x: 0, y: 0, w, h }, { measure: defaultMeasure });
  let out = "";
  for (const node of boxes) {
    if (node.children && node.children.length) continue;
    const tone = node.node.id === "title" ? "blue" : node.node.id === "col-left" ? "gold" : "green";
    out += card(node.box, {
      id: node.node.id,
      tone,
      lines: node.textLayout?.lines ?? [],
      fontSize: node.node.id === "title" ? 18 : 13,
    });
  }
  return svg(w, h, out);
}

mountScene({ scene: buildScene, initialW: 900, initialH: 480 });
