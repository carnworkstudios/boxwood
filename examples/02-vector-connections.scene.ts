/**
 * 02 — Branching Vector Connections
 *
 * The headline feature: because Boxwood hands you absolute coordinates, drawing
 * connectors between laid-out cards is just geometry. Here a 1-source /
 * 3-worker / 1-sink pipeline is laid out, then connect() (from kit.ts) routes a
 * bezier between each pair of boxes.
 *
 * Resize narrower than it is tall and the split flips columns→rows; connect()
 * picks the facing edges from each box's relative position, so the same six
 * curves stay correctly routed in both orientations — no direction branching.
 */

import { resolveLayout, defaultMeasure } from "../index.js";
import type { LNode } from "../types.js";
import { connect } from "./kit.js";
import { mountScene, svg, card, type Tone, type Viewport } from "./shell.js";

const measure = (text: string, fontSize = 14) => (avail: { w: number }) =>
  defaultMeasure(text, { fontSize }, avail.w);

const NODES: Record<string, { tone: Tone; text: string }> = {
  source: { tone: "blue", text: "Source — ingest stream" },
  "worker-a": { tone: "green", text: "Worker A — resize images" },
  "worker-b": { tone: "green", text: "Worker B — transcode video" },
  "worker-c": { tone: "green", text: "Worker C — extract text" },
  sink: { tone: "pink", text: "Sink — write to store" },
};

function leaf(id: string): LNode {
  return { id, style: { padding: 12 }, measure: measure(NODES[id].text, 14) };
}

function buildTree(orientation: "wide" | "tall"): LNode {
  const outer = orientation === "wide" ? { cols: 3, gap: 28 } : { rows: 3, gap: 24 };
  const innerWorkers = orientation === "wide" ? { rows: 3, gap: 16 } : { cols: 3, gap: 16 };
  return {
    style: { padding: 24 },
    split: outer as any,
    children: [
      { style: { w: "100%", h: "100%" }, split: { rows: 1 }, children: [leaf("source")] },
      { style: { w: "100%", h: "100%" }, split: innerWorkers as any, children: [leaf("worker-a"), leaf("worker-b"), leaf("worker-c")] },
      { style: { w: "100%", h: "100%" }, split: { rows: 1 }, children: [leaf("sink")] },
    ],
  };
}

function buildScene({ w, h }: Viewport): string {
  const tree = buildTree(w >= h ? "wide" : "tall");
  const { boxes } = resolveLayout(tree, { x: 0, y: 0, w, h }, { measure: defaultMeasure });
  const box = (id: string) => boxes.find((n) => n.node.id === id)?.box;

  // Cards
  let cards = "";
  for (const node of boxes) {
    if (node.children && node.children.length) continue;
    const meta = NODES[node.node.id ?? ""];
    if (!meta) continue;
    cards += card(node.box, { id: node.node.id, tone: meta.tone, lines: node.textLayout?.lines ?? [] });
  }

  // Connectors: source→each worker, each worker→sink. connect() picks the
  // facing edges, so this works identically in both orientations.
  const src = box("source");
  const snk = box("sink");
  const workers = ["worker-a", "worker-b", "worker-c"].map(box);
  let arrows = "";
  if (src && snk) {
    for (const wk of workers) {
      if (!wk) continue;
      for (const d of [connect(src, wk).d, connect(wk, snk).d]) {
        arrows += `<path d="${d}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="6 5" marker-end="url(#arrow)" opacity="0.85" />`;
      }
    }
  }

  return svg(w, h, cards + arrows);
}

mountScene({ scene: buildScene, initialW: 900, initialH: 520 });
