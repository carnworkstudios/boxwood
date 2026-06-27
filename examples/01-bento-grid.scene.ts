/**
 * 01 — Responsive Bento Grid
 *
 * How you'd use Boxwood for a fixed dashboard grid. One tree is split into
 * weighted cells — a hero tile, four KPI tiles, a timeline strip — and resized
 * live. Unlike the flow examples (03/04) where boxes GROW to their text, a
 * bento grid must keep its cell proportions, so each tile instead SHRINKS its
 * text to fit the cell via the engine's shrinkToFit(). That is the right model
 * for a fixed grid: the layout owns the geometry, the content adapts to it —
 * so nothing ever overflows or overlaps, at any width.
 *
 * The integration is buildScene() — resolve the tree, then draw the boxes.
 */

import { resolveLayout, defaultMeasure, shrinkToFit } from "../index.js";
import type { LBox, LNode } from "../types.js";
import { mountScene, svg, card, type Tone, type Viewport } from "./shell.js";

/**
 * A measure hook that shrinks `text` until it fits the cell it is given
 * (avail.w × avail.h), never growing the box.
 *
 * Two details matter for the text to actually fit the *rendered* card, not just
 * the math: card() draws a monospaced id label above the body (≈ LABEL_H px)
 * and spaces body lines at LINE_H × font. We reserve the label space and scale
 * the height budget by the render line-height before asking shrinkToFit for a
 * size, then re-measure once to report the size it truly settled on (which
 * defaultMeasure may shrink further to fit the width) so the renderer draws the
 * lines at the same size they were wrapped at.
 */
const LABEL_H = 30; // vertical room card() reserves for the id label
const LINE_H = 1.3; // must match card()'s body line spacing

const fitText = (text: string, startFont: number, floor = 8) => (avail: LBox) => {
  const budget = avail.h > 0 ? Math.max(12, (avail.h - LABEL_H) * (1.2 / LINE_H)) : 1e5;
  const r = shrinkToFit(text, startFont, avail.w, budget, defaultMeasure, floor);
  // Re-measure at the size shrinkToFit chose to recover the TRUE fitted metrics
  // (defaultMeasure auto-fits the width, so the real size ≤ r.fontSize).
  const m = defaultMeasure(text, { fontSize: r.fontSize }, avail.w);
  return { lines: m.lines, w: m.w, h: m.h, ascent: m.ascent, descent: m.descent };
};

const TILES: { id: string; tone: Tone; text: string; weight: number; font: number }[] = [
  { id: "hero", tone: "amber", weight: 2, font: 22, text: "Revenue this quarter is up 18% — the strongest run since launch, driven by the new self-serve tier." },
  { id: "kpi-1", tone: "signal", weight: 1, font: 15, text: "Active users · 42,180" },
  { id: "kpi-2", tone: "ember", weight: 1, font: 15, text: "Conversion · 3.9%" },
  { id: "kpi-3", tone: "ink", weight: 1, font: 15, text: "Churn · 1.2%" },
  { id: "kpi-4", tone: "signal", weight: 1, font: 15, text: "NPS · 61" },
  { id: "timeline", tone: "ink", weight: 2, font: 13, text: "Activity — 14:02 deploy · 13:41 alert cleared · 12:10 backup ok · 11:55 new region online" },
];

/** A tile is a FIXED-height cell (h:100% of its slot) whose text shrinks to fit. */
function tile(id: string): LNode {
  const t = TILES.find((x) => x.id === id)!;
  return { id, style: { padding: 14, h: "100%" }, measure: fitText(t.text, t.font) };
}

function buildTree(orientation: "wide" | "tall"): LNode {
  if (orientation === "wide") {
    // 3 columns: a tall hero + timeline on the left, two KPI stacks on the
    // right. All tracks are fixed proportions, so the grid never reflows its
    // shape — only the content rescales.
    return {
      style: { padding: 18 },
      split: { cols: ["50%", "25%", "25%"], gap: 14 },
      children: [
        { style: { w: "100%", h: "100%" }, split: { rows: ["62%", "38%"], gap: 14 }, children: [tile("hero"), tile("timeline")] },
        { style: { w: "100%", h: "100%" }, split: { rows: 2, gap: 14 }, children: [tile("kpi-1"), tile("kpi-3")] },
        { style: { w: "100%", h: "100%" }, split: { rows: 2, gap: 14 }, children: [tile("kpi-2"), tile("kpi-4")] },
      ],
    };
  }

  // Narrow: collapse to a single weighted column. Row heights come from each
  // tile's weight (normalized below 100% to leave room for the gaps), so hero
  // and timeline stay prominent while the KPIs compress — the classic mobile
  // bento, still a fixed grid.
  const total = TILES.reduce((a, t) => a + t.weight, 0);
  const rows = TILES.map((t) => `${((t.weight / total) * 88).toFixed(2)}%` as `${number}%`);
  return {
    style: { padding: 16 },
    split: { rows, gap: 12 },
    children: TILES.map((t) => tile(t.id)),
  };
}

function buildScene({ w, h }: Viewport): string {
  const tree = buildTree(w >= h ? "wide" : "tall");
  const { boxes } = resolveLayout(tree, { x: 0, y: 0, w, h }, { measure: defaultMeasure });

  let out = "";
  for (const node of boxes) {
    if (node.children && node.children.length) continue;
    const t = TILES.find((x) => x.id === node.node.id);
    out += card(node.box, {
      id: node.node.id,
      tone: t?.tone ?? "ink",
      lines: node.textLayout?.lines ?? [],
      fontSize: node.textLayout?.fontSize ?? 13,
    });
  }
  return svg(w, h, out);
}

mountScene({ scene: buildScene, initialW: 900, initialH: 560 });
