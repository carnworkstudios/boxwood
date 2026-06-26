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

function resolveNode(
  node: LNode,
  parentFrame: LBox,
  slotBox: LBox | null,
  ctx: { measure: Measure },
  overflow: OverflowSignal[],
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
    boxH = slotBox.h !== 0 ? slotBox.h : hRes.h;
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
  // content frame for row distribution.
  if (boxH === 0 && !node.measure) {
    margined.h = parentFrame.h;
    contentFrame.h = Math.max(0, parentFrame.h - pad.top - pad.bottom);
  }

  let children: ResolvedLNode[] | undefined;
  let textLayout: TextLayout | undefined;

  if (node.split) {
    children = resolveSplitChildren(node, node.split, contentFrame, ctx, overflow);
  } else if (node.children && node.children.length > 0) {
      children = node.children.map((child) =>
      resolveNode(child, contentFrame, null, ctx, overflow),
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
    if (boxH === 0) {
      const totalH = measured.h + pad.top + pad.bottom;
      margined.h = Math.max(totalH, 1);
      contentFrame.h = Math.max(measured.h, 1);
    }
    if (measured.h > contentFrame.h && contentFrame.h > 0) {
      overflow.push({
        path: "",
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
  ctx: { measure: Measure },
  overflow: OverflowSignal[],
): ResolvedLNode[] {
  const ch = node.children;
  if (!ch || ch.length === 0) return [];

  const gap = "gap" in split && split.gap !== undefined ? resolveGap(split.gap, contentFrame.w) : 0;
  const sp = "pad" in split && split.pad !== undefined ? resolveSides(split.pad as any) : resolveSides(undefined);

  if ("rows" in split && (typeof split.rows === "number" || Array.isArray(split.rows))) {
    const innerW = contentFrame.w - sp.left - sp.right;
    const intrinsicHs: number[] = [];
    for (let i = 0; i < ch.length; i++) {
      intrinsicHs.push(estimateIntrinsicHeight(ch[i], innerW, ctx.measure));
    }
    const innerH = contentFrame.h - sp.top - sp.bottom;
    const rowSpecs = resolveRowHeights(split.rows, innerH, gap, intrinsicHs);
    const cells = splitRows(contentFrame, rowSpecs, gap, sp);
    return ch.map((child, i) => {
      const cell = cells[Math.min(i, cells.length - 1)];
      return resolveNode(child, contentFrame, cell, ctx, overflow);
    });
  }

  if ("cols" in split && (typeof split.cols === "number" || Array.isArray(split.cols))) {
    const innerW = contentFrame.w - sp.left - sp.right;
    const colSpecs = resolveColWidths(split.cols, innerW, gap);
    const cells = splitCols(contentFrame, colSpecs, gap, sp);
    return ch.map((child, i) => {
      const cell = cells[Math.min(i, cells.length - 1)];
      return resolveNode(child, contentFrame, cell, ctx, overflow);
    });
  }

  if ("grid" in split) {
    const cells = splitGrid(contentFrame, split.grid, gap, sp);
    return ch.map((child, i) => {
      const cell = cells[Math.min(i, cells.length - 1)];
      return resolveNode(child, contentFrame, cell, ctx, overflow);
    });
  }

  if ("zones" in split) {
    const cells = splitZones(split.zones);
    return ch.map((child, i) => {
      const cell = cells[Math.min(i, cells.length - 1)];
      return resolveNode(child, contentFrame, cell, ctx, overflow);
    });
  }

  return [];
}

function estimateIntrinsicHeight(
  child: LNode,
  innerW: number,
  measure: Measure,
): number {
  if (!child.measure) {
    if (child.children && child.children.length > 0) {
      return 60;  // default min row height for containers
    }
    return 0;
  }
  const avail: LBox = { x: 0, y: 0, w: innerW, h: 0 };
  const m = child.measure(avail);
  const pad = resolveSides(child.style.padding);
  return m.h + pad.top + pad.bottom;
}

export function resolveLayout(
  root: LNode,
  world: LBox,
  hooks?: { measure?: Measure },
): LayoutResult {
  const measure = hooks?.measure ?? defaultMeasure;
  const overflow: OverflowSignal[] = [];
  const resolved = resolveNode(root, world, null, { measure }, overflow);
  const boxes: ResolvedLNode[] = [];
  flattenResolved(resolved, boxes);
  resolveCollisions(boxes, world);
  return { root: resolved, boxes, overflow };
}
