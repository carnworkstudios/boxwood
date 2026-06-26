import { wrapText, fitFontSize, MIN_READABLE } from "./text-fit.js";
import type { Measure, LBox } from "./types.js";

const FALLBACK_CHAR_WIDTH = 8;

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * (FALLBACK_CHAR_WIDTH / 14);
}

export function defaultMeasure(
  text: string,
  style: { fontSize: number },
  maxW: number,
): { lines: string[]; w: number; h: number; ascent: number; descent: number } {
  const size = fitFontSize(
    style.fontSize,
    maxW,
    (s) => estimateTextWidth(text, s),
  );
  const charW = size * (FALLBACK_CHAR_WIDTH / 14);
  const measureText = (t: string) => t.length * charW;
  const lines = wrapText(text, maxW, measureText);
  const lineH = size * 1.2;
  const ascent = size * 0.8;
  const descent = size * 0.2;
  return {
    lines,
    w: Math.min(maxW, Math.max(...lines.map(measureText))),
    h: lines.length * lineH,
    ascent,
    descent,
  };
}

export function shrinkToFit(
  text: string,
  fontSize: number,
  maxW: number,
  maxH: number,
  measurePage: Measure,
  floor: number = MIN_READABLE,
): { fontSize: number; lines: string[]; h: number } {
  let size = fontSize;
  while (size >= floor) {
    const m = measurePage(text, { fontSize: size }, maxW);
    if (m.h <= maxH) {
      return { fontSize: size, lines: m.lines, h: m.h };
    }
    size -= 1;
  }
  const m = measurePage(text, { fontSize: floor }, maxW);
  return { fontSize: floor, lines: m.lines, h: m.h };
}
