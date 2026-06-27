import type { LBox, LNode, Len, Measure, Pos, ResolvedLNode, Split, LayoutResult, OverflowSignal, TextLayout } from "./types.js";
import {
  resolveSides,
  resolveGap,
  resolveColWidths,
  resolveRowHeights,
  splitCols,
  splitRows,
  splitGrid,
  splitZones,
} from "./split.js";
import { defaultMeasure } from "./measure.js";
import { resolveCollisions } from "./collide.js";

function applyMargin(box: LBox, margin: ReturnType<typeof resolveSides>): LBox {
  return {
    x: box.x + margin.left,
    y: box.y + margin.top,
    w: Math.max(0, box.w - margin.left - margin.right),
    h: Math.max(0, box.h - margin.top - margin.bottom),
  };
}

function applyPad(box: LBox, pad: ReturnType<typeof resolveSides>): LBox {
  return {
    x: box.x + pad.left,
    y: box.y + pad.top,
    w: Math.max(0, box.w - pad.left - pad.right),
    h: Math.max(0, box.h - pad.top - pad.bottom),
  };
}

function resolveLen(v: Len | undefined, parentSize: number, defaultVal: number): number {
  if (v === undefined) return defaultVal;
  if (v === "auto") return defaultVal;
  if (typeof v === "number") return v;
  const pct = parseFloat(v);
  if (v.endsWith("%") && !isNaN(pct)) return (pct / 100) * parentSize;
  return defaultVal;
}

function resolvePos(pos: Pos | undefined, parentFrame: LBox, nodeW: number, nodeH: number): { x: number; y: number } {
  if (pos === "center") {
    return {
      x: parentFrame.x + (parentFrame.w - nodeW) / 2,
      y: parentFrame.y + (parentFrame.h - nodeH) / 2,
    };
  }
  if (pos === undefined) {
    return { x: parentFrame.x, y: parentFrame.y };
  }
  return {
    x: pos.x !== undefined ? resolveLen(pos.x, parentFrame.w, parentFrame.x) : parentFrame.x,
    y: pos.y !== undefined ? resolveLen(pos.y, parentFrame.h, parentFrame.y) : parentFrame.y,
  };
}

function flattenResolved(node: ResolvedLNode, out: ResolvedLNode[]): void {
  out.push(node);
  if (node.children) {
    for (const c of node.children) flattenResolved(c, out);
  }
}

function resolveBoxHeight(
  styleH: Len | undefined,
  parentH: number,
): { h: number; isAuto: boolean } {
  if (styleH === undefined || styleH === "auto") {
    return { h: 0, isAuto: true };
  }
  if (typeof styleH === "number") {
    return { h: styleH, isAuto: false };
  }
  if (typeof styleH === "string" && styleH.endsWith("%")) {
    const pct = parseFloat(styleH);
    if (!isNaN(pct)) return { h: (pct / 100) * parentH, isAuto: false };
  }
  return { h: 0, isAuto: true };
}

interface Ctx {
  measure: Measure;
  overflow: OverflowSignal[];
}

/** True when a node's height is determined by its content (no explicit fixed h). */
function isAutoHeight(node: LNode): boolean {
  return node.style.h === undefined || node.style.h === "auto";
}

function resolveNode(
  node: LNode,
  parentFrame: LBox,
  slotBox: LBox | null,
  ctx: Ctx,
  path: string,
): ResolvedLNode {
  const margin = resolveSides(node.style.margin);
  const pad = resolveSides(node.style.padding);

  let boxW: number;
  let boxH: number;
  let boxX: number;
  let boxY: number;
  const hRes = resolveBoxHeight(node.style.h, parentFrame.h);

  if (slotBox) {
    boxW = slotBox.w;
    // A slot only pins the height of a child that asked to be pinned (fixed h).
    // An auto-height child instead grows to its own measured content (PASS 2 of
    // the two-pass resolve), so it can push siblings rather than clip silently.
    if (slotBox.h !== 0 && !hRes.isAuto) {
      boxH = slotBox.h;
    } else if (slotBox.h !== 0 && hRes.isAuto) {
      // The slot carries the intrinsic height computed bottom-up in pass 1, but
      // a content-tall child may still exceed it — take the larger of the two.
      const innerW = Math.max(0, slotBox.w - pad.left - pad.right - margin.left - margin.right);
      boxH = Math.max(slotBox.h, measureIntrinsicHeight(node, innerW, ctx.measure));
    } else {
      boxH = hRes.h;
    }
    boxX = slotBox.x;
    boxY = slotBox.y;
  } else {
    boxW = resolveLen(node.style.w, parentFrame.w, parentFrame.w);
    boxH = hRes.h;
    const posRes = resolvePos(node.style.pos, parentFrame, boxW, boxH || parentFrame.h);
    boxX = posRes.x;
    boxY = posRes.y;
  }

  let margined: LBox = applyMargin({ x: boxX, y: boxY, w: boxW, h: boxH }, margin);
  let contentFrame: LBox = applyPad(margined, pad);

  // Fix container auto-height BEFORE resolving children — children need a real
  // content frame for row distribution. A non-slotted auto container fills its
  // parent frame (it is the outermost box of its subtree, like <body>); a
  // SLOTTED auto container instead grew to its content above, so respect that.
  if (boxH === 0 && !node.measure) {
    margined.h = parentFrame.h;
    contentFrame.h = Math.max(0, parentFrame.h - pad.top - pad.bottom);
  }

  let children: ResolvedLNode[] | undefined;
  let textLayout: TextLayout | undefined;

  if (node.split) {
    children = resolveSplitChildren(node, node.split, contentFrame, ctx, path);
  } else if (node.children && node.children.length > 0) {
      children = node.children.map((child, i) =>
      resolveNode(child, contentFrame, null, ctx, childPath(path, child, i)),
    );
  }

  if (node.measure && contentFrame.w > 0) {
    const measured = node.measure(contentFrame);
    textLayout = {
      lines: measured.lines,
      fontSize: measured.ascent ? Math.round(measured.ascent / 0.8) : 14,
      ascent: measured.ascent,
      descent: measured.descent,
    };
    // Auto-height text grows its box to the measured content (and a slotted
    // auto child already had its slot grown above). Only a node whose height
    // was explicitly fixed keeps it — and overflows when the text won't fit.
    if (isAutoHeight(node)) {
      const totalH = measured.h + pad.top + pad.bottom;
      margined.h = Math.max(margined.h, totalH, 1);
      contentFrame.h = Math.max(contentFrame.h, measured.h, 1);
    } else if (measured.h > contentFrame.h && contentFrame.h > 0) {
      ctx.overflow.push({
        path,
        box: contentFrame,
        fontSize: textLayout.fontSize,
        text: measured.lines.join(" "),
      });
    }
  }

  const resolved: ResolvedLNode = {
    node,
    box: { x: margined.x, y: margined.y, w: margined.w, h: margined.h },
    contentFrame: { x: contentFrame.x, y: contentFrame.y, w: contentFrame.w, h: contentFrame.h },
    textLayout,
    children,
  };
  if (children) {
    for (const c of children) c.parent = resolved;
  }

  return resolved;
}

function resolveSplitChildren(
  node: LNode,
  split: Split,
  contentFrame: LBox,
  ctx: Ctx,
  path: string,
): ResolvedLNode[] {
  const ch = node.children;
  if (!ch || ch.length === 0) return [];

  const gap = "gap" in split && split.gap !== undefined ? resolveGap(split.gap, contentFrame.w) : 0;
  const sp = "pad" in split && split.pad !== undefined ? resolveSides(split.pad as any) : resolveSides(undefined);

  const place = (cells: LBox[]) =>
    ch.map((child, i) => {
      const cell = cells[Math.min(i, cells.length - 1)];
      return resolveNode(child, contentFrame, cell, ctx, childPath(path, child, i));
    });

  if ("rows" in split && (typeof split.rows === "number" || Array.isArray(split.rows))) {
    const innerW = contentFrame.w - sp.left - sp.right;
    // PASS 1 (bottom-up): every child reports the real height it needs at the
    // available width — recursing through nested containers — so `auto` rows
    // are sized to content instead of a guess.
    const intrinsicHs = ch.map((c) => measureIntrinsicHeight(c, innerW, ctx.measure));
    const innerH = contentFrame.h - sp.top - sp.bottom;
    const rowSpecs = resolveRowHeights(split.rows, innerH, gap, intrinsicHs);
    return place(splitRows(contentFrame, rowSpecs, gap, sp));
  }

  if ("cols" in split && (typeof split.cols === "number" || Array.isArray(split.cols))) {
    const innerW = contentFrame.w - sp.left - sp.right;
    const colSpecs = resolveColWidths(split.cols, innerW, gap);
    return place(splitCols(contentFrame, colSpecs, gap, sp));
  }

  if ("grid" in split) {
    return place(splitGrid(contentFrame, split.grid, gap, sp));
  }

  if ("zones" in split) {
    return place(splitZones(split.zones));
  }

  return [];
}

/**
 * PASS 1 — bottom-up intrinsic height.
 *
 * Returns the content height (including the node's own padding) that `node`
 * needs to contain everything inside it at the given available width. This is
 * the half the single-pass resolver lacked: a child's measured/wrapped height
 * travels back UP so ancestors and sibling slots can be sized before final
 * placement, instead of being guessed (the old hardcoded `60`).
 */
function measureIntrinsicHeight(node: LNode, availW: number, measure: Measure): number {
  const pad = resolveSides(node.style.padding);
  const margin = resolveSides(node.style.margin);
  const innerW = Math.max(0, availW - pad.left - pad.right - margin.left - margin.right);

  // A node with an explicit fixed height contributes exactly that height.
  if (!isAutoHeight(node)) {
    const fixed = resolveBoxHeight(node.style.h, 0);
    if (!fixed.isAuto) return fixed.h + margin.top + margin.bottom;
  }

  // Leaf text: measure and wrap at the available content width.
  if (node.measure) {
    const m = node.measure({ x: 0, y: 0, w: innerW, h: 0 });
    return m.h + pad.top + pad.bottom + margin.top + margin.bottom;
  }

  // Container: combine children's intrinsic heights per split type.
  const ch = node.children;
  if (!ch || ch.length === 0) return 0;

  const split = node.split;
  const gap =
    split && "gap" in split && split.gap !== undefined ? resolveGap(split.gap, innerW) : 0;
  const sp =
    split && "pad" in split && (split as any).pad !== undefined
      ? resolveSides((split as any).pad)
      : resolveSides(undefined);
  const childW = Math.max(0, innerW - sp.left - sp.right);

  let inner: number;
  if (split && "cols" in split) {
    // Columns sit side by side — the row is as tall as the TALLEST column.
    const n = Array.isArray(split.cols) ? split.cols.length : split.cols;
    const colW = n > 0 ? (childW - gap * (n - 1)) / n : childW;
    inner = Math.max(0, ...ch.map((c) => measureIntrinsicHeight(c, colW, measure)));
  } else if (split && "grid" in split) {
    const [cols, rows] = split.grid;
    const cellW = cols > 0 ? (childW - gap * (cols - 1)) / cols : childW;
    const cellHs = ch.map((c) => measureIntrinsicHeight(c, cellW, measure));
    let tallestRow = 0;
    for (let r = 0; r < rows; r++) {
      const rowMax = Math.max(0, ...cellHs.slice(r * cols, r * cols + cols));
      tallestRow = Math.max(tallestRow, rowMax);
    }
    inner = tallestRow * rows + gap * Math.max(0, rows - 1);
  } else if (split && "zones" in split) {
    // Absolutely-zoned children don't stack; take the lowest bottom edge.
    inner = Math.max(0, ...Object.values(split.zones).map((z) => z.y + z.h));
  } else {
    // rows split OR a plain (no-split) container: children stack vertically.
    const hs = ch.map((c) => measureIntrinsicHeight(c, childW, measure));
    inner = hs.reduce((a, b) => a + b, 0) + gap * Math.max(0, hs.length - 1);
  }

  return inner + sp.top + sp.bottom + pad.top + pad.bottom + margin.top + margin.bottom;
}

/** Build the dotted path used in OverflowSignal (e.g. "root.children[1].grid[3]"). */
function childPath(parentPath: string, child: LNode, index: number): string {
  const key = child.id ?? `[${index}]`;
  return parentPath ? `${parentPath}.${key}` : key;
}

export function resolveLayout(
  root: LNode,
  world: LBox,
  hooks?: { measure?: Measure; collide?: boolean },
): LayoutResult {
  const measure = hooks?.measure ?? defaultMeasure;
  const overflow: OverflowSignal[] = [];
  const rootPath = root.id ?? "root";
  const resolved = resolveNode(root, world, null, { measure, overflow }, rootPath);
  const boxes: ResolvedLNode[] = [];
  flattenResolved(resolved, boxes);
  // Collision separation is a post-layout geometric pass; on by default, opt
  // out with { collide: false } when overlap is intentional.
  if (hooks?.collide !== false) {
    resolveCollisions(boxes, world);
  }
  return { root: resolved, boxes, overflow };
}
