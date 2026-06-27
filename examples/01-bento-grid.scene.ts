/**
 * 01 — Responsive Bento Grid
 *
 * How you'd use Boxwood for a dashboard: one tree split into a grid, with a
 * couple of cells given more weight to form a "hero" tile and a wide footer
 * strip. Every tile has a real measure hook, so when you resize the panel the
 * grid reflows AND each tile grows to fit its wrapped copy (auto-height rows).
 *
 * The integration is buildScene() — resolve the tree, then draw the boxes.
 */

import { resolveLayout, defaultMeasure } from "../index.js";
import type { LNode } from "../types.js";
import { mountScene, svg, card, type Tone, type Viewport } from "./shell.js";

const measure = (text: string, fontSize = 14) => (avail: { w: number }) =>
  defaultMeasure(text, { fontSize }, avail.w);

const TILES: { id: string; tone: Tone; text: string; weight?: number }[] = [
  { id: "hero", tone: "gold", weight: 2, text: "Revenue this quarter is up 18% — the strongest run since launch, driven by the new self-serve tier." },
  { id: "kpi-1", tone: "green", text: "Active users 42,180" },
  { id: "kpi-2", tone: "blue", text: "Conversion 3.9%" },
  { id: "kpi-3", tone: "pink", text: "Churn 1.2%" },
  { id: "kpi-4", tone: "green", text: "NPS 61" },
  { id: "timeline", tone: "slate", weight: 2, text: "Activity — 14:02 deploy · 13:41 alert cleared · 12:10 backup ok · 11:55 new region online" },
];

function buildTree(orientation: "wide" | "tall"): LNode {
  // Wide: a 3-column grid where hero spans two cols on top and the timeline
  // spans two on the bottom. Narrow: collapse to a single column stack — the
  // same content, the classic mobile reflow.
  const cols: (string | number)[] =
    orientation === "wide" ? ["50%", "25%", "25%"] : ["100%"];

  return {
    style: { padding: 18 },
    split: { cols, gap: 14 } as any,
    children:
      orientation === "wide"
        ? [
            // left column: hero on top, timeline below
            {
              style: { w: "100%", h: "100%" },
              split: { rows: ["62%", "38%"], gap: 14 },
              children: [tile("hero"), tile("timeline")],
            },
            // middle + right columns: two KPI stacks
            {
              style: { w: "100%", h: "100%" },
              split: { rows: 2, gap: 14 },
              children: [tile("kpi-1"), tile("kpi-3")],
            },
            {
              style: { w: "100%", h: "100%" },
              split: { rows: 2, gap: 14 },
              children: [tile("kpi-2"), tile("kpi-4")],
            },
          ]
        : [
            {
              style: { w: "100%", h: "100%" },
              split: { rows: ["auto", "auto", "auto", "auto", "auto", "auto"], gap: 12 },
              children: TILES.map((t) => tile(t.id)),
            },
          ],
  };
}

function tile(id: string): LNode {
  const t = TILES.find((x) => x.id === id)!;
  return { id, style: { padding: 14 }, measure: measure(t.text, id === "hero" ? 17 : 14) };
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
      tone: t?.tone ?? "slate",
      lines: node.textLayout?.lines ?? [],
      fontSize: node.node.id === "hero" ? 16 : 13,
    });
  }
  return svg(w, h, out);
}

mountScene({ scene: buildScene, initialW: 900, initialH: 560 });
