/**
 * Self-contained text-fit helpers used by the default measure hook.
 *
 * These are intentionally measurement-agnostic: callers pass a `measure`
 * closure (e.g. over a canvas `ctx.measureText`), so the engine never depends
 * on a DOM or any specific rasterizer.
 */

/** Hard floor — nothing should render below this. */
export const MIN_READABLE = 14;

/**
 * Shrink a font size so `text` fits within `maxWidth`, but never below the hard
 * floor. Returns the largest size ≤ `size` that fits, or MIN_READABLE if even
 * that overflows (the caller may then wrap). `measure(sizePx)` returns text
 * width at that size.
 */
export function fitFontSize(
  size: number,
  maxWidth: number,
  measure: (sizePx: number) => number,
): number {
  if (maxWidth <= 0) return size;
  let s = size;
  while (s > MIN_READABLE && measure(s) > maxWidth) {
    s -= 1;
  }
  return Math.max(MIN_READABLE, s);
}

/**
 * Greedy word-wrap into lines that each fit `maxWidth`. `measure(text)` returns
 * width at the current font. Long single words are kept whole.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  measure: (text: string) => number,
): string[] {
  if (maxWidth <= 0 || !text) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (measure(trial) <= maxWidth || !cur) {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
