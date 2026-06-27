/**
 * Shared example "kit" — content-aware drawing helpers layered on top of
 * resolveLayout(), mirroring how production consumers actually use Boxwood
 * (see utils/draw.tsx + utils/relate.tsx in the Remotion video renderer this
 * engine ships inside of):
 *
 *   1. The split tree gives every box its *proportional* geometry — this is
 *      the CSS-flexbox-like part, and it's what makes the layout responsive.
 *   2. fitBox()/fitBoxesUniform() then GROW a resolved box just enough to
 *      contain its real text at a target font, re-centering on the box's own
 *      center so siblings in a row/grid stay aligned. This is the "intrinsic
 *      sizing" half of the story: content can make a box bigger than its
 *      proportional slot, the same way a CSS grid track can grow for content.
 *   3. Connector-style helpers pick facing edges between two boxes from their
 *      relative position, so the same connection code works whether the
 *      layout is a horizontal row (desktop) or a vertical stack (the same
 *      tree, reflowed at a narrow width) — no direction branching needed.
 *
 * Every example below resolves the SAME tree at multiple viewport widths to
 * prove the responsiveness claim: this is the absolute-coordinate engine's
 * answer to "does it reflow like CSS?".
 */

import { defaultMeasure } from "../measure.js";
import type { LBox } from "../types.js";

export interface FittedText {
  lines: string[];
  fontSize: number;
  totalH: number;
}

/** Shrink-to-fit a single text block inside availW x availH, walking font size down. */
export function fitText(
  text: string,
  availW: number,
  availH: number,
  start = 16,
  floor = 11,
): FittedText {
  let fontSize = start;
  let lines: string[] = [];
  let totalH = 0;
  while (fontSize >= floor) {
    const m = defaultMeasure(text, { fontSize }, availW);
    if (m.h <= availH || fontSize === floor) {
      lines = m.lines;
      totalH = m.h;
      break;
    }
    fontSize -= 0.5;
  }
  return { lines, fontSize, totalH };
}

export interface FitBoxOpts {
  fontSize?: number;
  padX?: number;
  padY?: number;
  /** Cap on grown width (only used when growWidth). */
  maxW?: number;
  /** Allow the box to widen if a line is wider than it (else only height grows). */
  growWidth?: boolean;
}

export interface FittedBox {
  box: LBox;
  lines: string[];
  fontSize: number;
}

/**
 * INTRINSIC SIZING — grow `box` so `text` fits at the target font instead of
 * shrinking text to fit a fixed box. Height always grows to fit wrapped
 * lines; width grows only when `growWidth`. Re-anchored on the box's own
 * center so a row/grid stays aligned. Returns the wrapped lines alongside the
 * grown box so callers never have to re-measure for display. This is the
 * single mechanism every example below uses to prove "the box contains its
 * content," exactly like the production fitBox() in utils/draw.tsx.
 */
export function fitBox(box: LBox, text: string, opts: FitBoxOpts = {}): FittedBox {
  const fontSize = opts.fontSize ?? 16;
  const padX = opts.padX ?? 16;
  const padY = opts.padY ?? 14;
  const maxW = opts.maxW ?? Math.max(box.w, 320);

  const contentW = Math.max(10, box.w - 2 * padX);
  const m = defaultMeasure(text, { fontSize }, contentW);
  const neededH = m.h + 2 * padY;

  let newW = box.w;
  if (opts.growWidth) {
    newW = Math.min(maxW, Math.max(box.w, m.w + 2 * padX));
  }
  const newH = Math.max(box.h, neededH);

  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return {
    box: { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH },
    lines: m.lines,
    fontSize,
  };
}

/** Grow a SET of boxes to a uniform height (the max any of them needs) so a row/grid stays aligned. */
export function fitBoxesUniform(boxes: LBox[], texts: string[], opts: FitBoxOpts = {}): FittedBox[] {
  if (boxes.length === 0) return [];
  const fitted = boxes.map((b, i) => fitBox(b, texts[i], opts));
  const maxH = Math.max(...fitted.map((f) => f.box.h));
  return fitted.map((f) => {
    const cx = f.box.x + f.box.w / 2;
    const cy = f.box.y + f.box.h / 2;
    return { ...f, box: { x: cx - f.box.w / 2, y: cy - maxH / 2, w: f.box.w, h: maxH } };
  });
}

export type Side = "top" | "right" | "bottom" | "left";
export interface Pt {
  x: number;
  y: number;
}

export function anchorOf(box: LBox, side: Side): Pt {
  const { x, y, w, h } = box;
  switch (side) {
    case "top":
      return { x: x + w / 2, y };
    case "bottom":
      return { x: x + w / 2, y: y + h };
    case "left":
      return { x, y: y + h / 2 };
    case "right":
      return { x: x + w, y: y + h / 2 };
  }
}

/**
 * Pick the facing pair of sides between two boxes from their relative
 * position. This is what lets a connector work whether the layout reflowed
 * into a horizontal row (wide viewport) or a vertical stack (narrow
 * viewport) — same call site, no direction branching, same idea as
 * nearestSides() in utils/relate.tsx.
 */
export function nearestSides(a: LBox, b: LBox): { from: Side; to: Side } {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const dx = bc.x - ac.x;
  const dy = bc.y - ac.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? { from: "right", to: "left" } : { from: "left", to: "right" };
  }
  return dy >= 0 ? { from: "bottom", to: "top" } : { from: "top", to: "bottom" };
}

/** A cubic-bezier connector path between the facing edges of two boxes. */
export function connect(a: LBox, b: LBox): { d: string; from: Pt; to: Pt } {
  const { from, to } = nearestSides(a, b);
  const fp = anchorOf(a, from);
  const tp = anchorOf(b, to);
  const horizontal = from === "left" || from === "right";
  const offset = Math.max(40, (horizontal ? Math.abs(tp.x - fp.x) : Math.abs(tp.y - fp.y)) * 0.4);
  const c1 = horizontal ? { x: fp.x + (from === "right" ? offset : -offset), y: fp.y } : { x: fp.x, y: fp.y + (from === "bottom" ? offset : -offset) };
  const c2 = horizontal ? { x: tp.x + (to === "left" ? -offset : offset), y: tp.y } : { x: tp.x, y: tp.y + (to === "top" ? -offset : offset) };
  const d = `M ${fp.x} ${fp.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${tp.x} ${tp.y}`;
  return { d, from: fp, to: tp };
}
