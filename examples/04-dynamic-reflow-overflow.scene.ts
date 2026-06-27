/**
 * 04 — Auto-Height, Overflow, and Collision Solving
 *
 * Three engine behaviors a real app needs, in one tree:
 *
 *   1. AUTO-HEIGHT — the top card has no fixed height, so it grows to contain
 *      its measured text at any width.
 *   2. OVERFLOW SIGNAL — the bottom card has a FIXED height. Shrink the panel
 *      until the wrapped text no longer fits and resolveLayout() returns a real
 *      OverflowSignal in result.overflow, which we surface as a banner. This is
 *      how you'd trigger a font shrink or a "show more" affordance.
 *   3. COLLISION — two absolutely-positioned badges are placed at the SAME
 *      coordinate on purpose; resolveCollisions (run inside resolveLayout)
 *      nudges them apart so they never overlap.
 */

import { resolveLayout, defaultMeasure } from "../index.js";
import type { LNode } from "../types.js";
import { mountScene, svg, card, esc, warnGlyph, type Viewport } from "./shell.js";

const measure = (text: string, fontSize = 14) => (avail: { w: number }) =>
  defaultMeasure(text, { fontSize }, avail.w);

const TOP_TEXT =
  "This card has no fixed height — it grows to contain its wrapped text at any width.";
const BOTTOM_TEXT =
  "This card is pinned to a fixed height. Narrow the panel until its wrapped text no longer fits inside that height and the engine emits a real OverflowSignal you can react to — shrink the font, paginate, or show a 'more' link.";

function buildTree(): LNode {
  // A plain container (no split). Each child is absolutely positioned with a
  // `pos`, so this is also the "place things by coordinate" case — exactly what
  // you do when porting absolute artwork. The two badges share one coordinate
  // on purpose to demonstrate collision separation.
  return {
    style: { padding: 20 },
    children: [
      // AUTO-HEIGHT: no `h`, so the box grows to the measured text. Watch it get
      // taller as you narrow the panel and the copy wraps onto more lines.
      { id: "auto-card", style: { padding: 16, pos: { x: 0, y: 0 } }, measure: measure(TOP_TEXT, 16) },

      // FIXED HEIGHT: an explicit numeric `h`. When the wrapped text needs more
      // than 100px the engine raises an OverflowSignal instead of growing — the
      // opposite of the auto card above.
      { id: "fixed-card", style: { padding: 16, h: 100, pos: { x: 0, y: "42%" } }, measure: measure(BOTTOM_TEXT, 15) },

      // COLLISION: two badges placed at the SAME coordinate. resolveCollisions
      // (run inside resolveLayout) nudges them apart so they never overlap.
      { id: "badge-a", style: { w: 70, h: 28, pos: { x: "72%", y: "40%" } } },
      { id: "badge-b", style: { w: 70, h: 28, pos: { x: "72%", y: "40%" } } },
    ],
  };
}

function buildScene({ w, h }: Viewport): string {
  const result = resolveLayout(buildTree(), { x: 0, y: 0, w, h }, { measure: defaultMeasure });
  const { boxes, overflow } = result;

  let out = "";
  for (const node of boxes) {
    const id = node.node.id;
    if (!id) continue;
    if (id === "badge-a" || id === "badge-b") {
      out += card(node.box, { id, tone: "ember" });
      continue;
    }
    if (node.children && node.children.length) continue;
    out += card(node.box, {
      id,
      tone: id === "auto-card" ? "amber" : "signal",
      lines: node.textLayout?.lines ?? [],
      fontSize: id === "auto-card" ? 16 : 14,
    });
  }

  // Surface any overflow signal as a banner — this is the actionable feedback
  // the engine gives you instead of silently clipping.
  if (overflow.length) {
    const o = overflow[0];
    const msg = `OverflowSignal · ${esc(o.path)} exceeds its ${Math.round(o.box.w)}×${Math.round(o.box.h)}px box`;
    out += `
      <g>
        <rect x="20" y="${h - 40}" width="${w - 40}" height="28" rx="4" fill="rgba(201,107,58,0.12)" stroke="#C96B3A" stroke-width="1.25" />
        ${warnGlyph(34, h - 33, 14, "#C96B3A")}
        <text x="58" y="${h - 21}" fill="#C96B3A" font-family="'JetBrains Mono', ui-monospace, monospace" font-size="11" letter-spacing="0.02em">${msg}</text>
      </g>`;
  }

  return svg(w, h, out);
}

mountScene({ scene: buildScene, initialW: 760, initialH: 560 });
