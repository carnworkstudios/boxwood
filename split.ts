import type { LBox, Len, Split, Sides } from "./types.js";

export function resolveSides(s: Sides | undefined): { top: number; right: number; bottom: number; left: number } {
  if (s === undefined) return { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof s === "number") return { top: s, right: s, bottom: s, left: s };
  return { top: s.top ?? 0, right: s.right ?? 0, bottom: s.bottom ?? 0, left: s.left ?? 0 };
}

function resolveLen(v: Len | undefined, parentSize: number, defaultVal: number): number {
  if (v === undefined) return defaultVal;
  if (v === "auto") return defaultVal;
  if (typeof v === "number") return v;
  const pct = parseFloat(v);
  if (v.endsWith("%") && !isNaN(pct)) return (pct / 100) * parentSize;
  return defaultVal;
}

export function resolveGap(
  gap: Len | undefined,
  parentSize: number,
): number {
  return resolveLen(gap, parentSize, 0);
}

export interface ColSpec {
  w: number;
  kind: "fixed" | "pct" | "auto";
  idx: number;
}

export interface RowSpec {
  h: number;
  kind: "fixed" | "pct" | "auto";
  idx: number;
}

export function resolveColWidths(
  spec: number | Len[],
  parentW: number,
  gap: number,
): ColSpec[] {
  if (typeof spec === "number") {
    const n = Math.max(1, spec);
    const colW = (parentW - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ w: colW, kind: "fixed" as const, idx: i }));
  }
  let totalFixed = 0;
  let totalPctPct = 0;
  let autoCount = 0;
  for (const s of spec) {
    if (typeof s === "number") {
      totalFixed += s;
    } else if (s === "auto") {
      autoCount++;
    } else if (s.endsWith("%")) {
      totalPctPct += parseFloat(s);
    }
  }
  const totalPct = (totalPctPct / 100) * parentW;
  const remaining = parentW - totalFixed - totalPct - gap * (spec.length - 1);
  const autoW = autoCount > 0 ? Math.max(0, remaining / autoCount) : 0;
  return spec.map((s, idx) => {
    if (typeof s === "number") return { w: s, kind: "fixed" as const, idx };
    if (s === "auto") return { w: autoW, kind: "auto" as const, idx };
    const pct = parseFloat(s);
    if (s.endsWith("%") && !isNaN(pct)) {
      return { w: (pct / 100) * parentW, kind: "pct" as const, idx };
    }
    return { w: 0, kind: "fixed" as const, idx };
  });
}

export function splitCols(
  parentFrame: LBox,
  cols: ColSpec[],
  gap: number,
  pad: { top: number; right: number; bottom: number; left: number },
): LBox[] {
  const innerX = parentFrame.x + pad.left;
  const innerY = parentFrame.y + pad.top;
  const innerW = parentFrame.w - pad.left - pad.right;
  const innerH = parentFrame.h - pad.top - pad.bottom;
  const boxes: LBox[] = [];
  let cx = innerX;
  for (const c of cols) {
    boxes.push({ x: cx, y: innerY, w: c.w, h: innerH });
    cx += c.w + gap;
  }
  return boxes;
}

export function resolveRowHeights(
  spec: number | Len[],
  parentH: number,
  gap: number,
  childIntrinsicHs: number[],
): RowSpec[] {
  if (typeof spec === "number") {
    const n = Math.max(1, spec);
    const rowH = (parentH - gap * (n - 1)) / n;
    return Array.from({ length: n }, (_, i) => ({ h: rowH, kind: "fixed" as const, idx: i }));
  }
  const n = spec.length;
  let usedFixed = 0;
  let usedPct = 0;
  const autoCount = spec.filter((s) => s === "auto").length;
  for (let i = 0; i < n; i++) {
    const s = spec[i];
    if (typeof s === "number") {
      usedFixed += s;
    } else if (typeof s === "string" && s.endsWith("%")) {
      const pct = parseFloat(s);
      if (!isNaN(pct)) usedPct += (pct / 100) * parentH;
    }
  }
  const remaining = parentH - usedFixed - usedPct - gap * (n - 1);
  const intrinsicTotal = childIntrinsicHs.reduce((a, b) => a + b, 0);
  let autoH = 0;
  if (autoCount > 0) {
    if (intrinsicTotal <= remaining) {
      autoH = intrinsicTotal / autoCount;
    } else {
      autoH = remaining / autoCount;
    }
  }
  return spec.map((s, idx) => {
    if (typeof s === "number") return { h: s, kind: "fixed" as const, idx };
    if (s === "auto") return { h: autoH, kind: "auto" as const, idx };
    const pct = parseFloat(s);
    if (s.endsWith("%") && !isNaN(pct)) {
      return { h: (pct / 100) * parentH, kind: "pct" as const, idx };
    }
    return { h: 0, kind: "fixed" as const, idx };
  });
}

export function splitRows(
  parentFrame: LBox,
  rows: RowSpec[],
  gap: number,
  pad: { top: number; right: number; bottom: number; left: number },
): LBox[] {
  const innerX = parentFrame.x + pad.left;
  const innerY = parentFrame.y + pad.top;
  const innerW = parentFrame.w - pad.left - pad.right;
  const innerH = parentFrame.h - pad.top - pad.bottom;
  const boxes: LBox[] = [];
  let cy = innerY;
  for (const r of rows) {
    boxes.push({ x: innerX, y: cy, w: innerW, h: r.h });
    cy += r.h + gap;
  }
  return boxes;
}

export function splitGrid(
  parentFrame: LBox,
  grid: [cols: number, rows: number],
  gap: number,
  pad: { top: number; right: number; bottom: number; left: number },
): LBox[] {
  const [nCols, nRows] = grid;
  const innerX = parentFrame.x + pad.left;
  const innerY = parentFrame.y + pad.top;
  const innerW = parentFrame.w - pad.left - pad.right;
  const innerH = parentFrame.h - pad.top - pad.bottom;
  const cellW = (innerW - gap * (nCols - 1)) / nCols;
  const cellH = (innerH - gap * (nRows - 1)) / nRows;
  const cells: LBox[] = [];
  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      cells.push({
        x: innerX + c * (cellW + gap),
        y: innerY + r * (cellH + gap),
        w: cellW,
        h: cellH,
      });
    }
  }
  return cells;
}

export function splitZones(
  zones: Record<string, LBox>,
): LBox[] {
  return Object.values(zones);
}
