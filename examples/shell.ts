/**
 * Browser-side runtime shared by every generated example page.
 *
 * The point of these examples is to prove that ONE declarative Boxwood tree
 * reflows like CSS when its container changes size. So the shell owns exactly
 * one thing: a resizable viewport with a drag handle and a few preset
 * breakpoints. On every resize it re-runs the scene's buildScene(viewport) —
 * which calls resolveLayout() fresh at the new width/height — and swaps in the
 * SVG it returns.
 *
 * There is no layout math here. All of it lives in each *.scene.ts, exactly
 * where a real consumer's render loop would call the engine. A scene is just:
 *
 *     export function buildScene(viewport: { w, h }): string  // returns SVG
 */

export interface Viewport {
  w: number;
  h: number;
}

export type Scene = (viewport: Viewport) => string;

interface MountOpts {
  scene: Scene;
  initialW: number;
  initialH: number;
}

const MIN = { w: 300, h: 240 };
const MAX = { w: 1100, h: 780 };

export function mountScene(opts: MountOpts): void {
  const stage = document.getElementById("stage") as HTMLDivElement;
  const readout = document.getElementById("readout") as HTMLDivElement;

  let w = clamp(opts.initialW, MIN.w, MAX.w);
  let h = clamp(opts.initialH, MIN.h, MAX.h);

  function render() {
    stage.style.width = `${w}px`;
    stage.style.height = `${h}px`;
    // The scene re-resolves the layout at the current size every call — this is
    // the same resolveLayout() invocation a production render loop makes.
    stage.innerHTML =
      opts.scene({ w, h }) +
      '<div id="handle" title="drag to resize"><i class="fa-solid fa-up-right-and-down-left-from-center"></i></div>';
    wireHandle();
    readout.textContent = `viewport ${Math.round(w)} × ${Math.round(h)} px — drag the corner to reflow`;
  }

  // Pointer-driven resize. Re-resolve on every move so the reflow is continuous.
  let drag: { x: number; y: number; w: number; h: number } | null = null;

  function wireHandle() {
    const handle = document.getElementById("handle") as HTMLDivElement;
    handle.addEventListener("pointerdown", (e) => {
      drag = { x: e.clientX, y: e.clientY, w, h };
      handle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
  }

  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    w = clamp(drag.w + (e.clientX - drag.x), MIN.w, MAX.w);
    h = clamp(drag.h + (e.clientY - drag.y), MIN.h, MAX.h);
    render();
  });
  window.addEventListener("pointerup", () => (drag = null));

  // Preset buttons jump between named breakpoints without dragging.
  document.querySelectorAll<HTMLButtonElement>("[data-w]").forEach((btn) => {
    btn.addEventListener("click", () => {
      w = clamp(Number(btn.dataset.w), MIN.w, MAX.w);
      h = clamp(Number(btn.dataset.h), MIN.h, MAX.h);
      render();
    });
  });

  render();
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/* ── tiny SVG helpers every scene shares ─────────────────────────────────── */

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const PALETTE: Record<string, { stroke: string; fill: string }> = {
  // CanWork Studios brand, light mode: a restrained amber / ember / signal
  // trio over warm paper, plus a neutral ink. Fills are faint tints of the
  // stroke so cards read as quiet surfaces, not blocks of color.
  amber: { stroke: "#C98A2E", fill: "rgba(232,164,74,0.16)" },
  ember: { stroke: "#C96B3A", fill: "rgba(201,107,58,0.14)" },
  signal: { stroke: "#3A86CF", fill: "rgba(74,158,232,0.14)" },
  ink: { stroke: "#5A5A52", fill: "rgba(42,42,42,0.05)" },
};

export type Tone = keyof typeof PALETTE;

export const BRAND = {
  paper: "#F0EDE8",
  ivory: "#FAF9F7",
  carbon: "#141414",
  ink: "#1E1E1E",
  fog: "#888888",
  line: "#DAD3C7",
  amber: "#C98A2E",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  body: "'DM Sans', system-ui, sans-serif",
  display: "'Playfair Display', Georgia, serif",
};

/** Draw one card box with a monospaced id label and optional wrapped text lines. */
export function card(
  box: { x: number; y: number; w: number; h: number },
  opts: { id?: string; tone?: Tone; lines?: string[]; fontSize?: number } = {},
): string {
  const { x, y, w, h } = box;
  const c = PALETTE[opts.tone ?? "ink"];
  const fs = opts.fontSize ?? 13;
  const lines = (opts.lines ?? [])
    .map((ln, i) => `<tspan x="${x + 14}" dy="${i === 0 ? 0 : fs * 1.3}">${esc(ln)}</tspan>`)
    .join("");
  return `
    <g>
      <rect x="${x + 0.75}" y="${y + 0.75}" width="${Math.max(0, w - 1.5)}" height="${Math.max(0, h - 1.5)}"
            rx="4" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" />
      ${opts.id ? `<text x="${x + 14}" y="${y + 22}" fill="${c.stroke}" font-family="${BRAND.mono}" font-size="10.5" font-weight="500" letter-spacing="0.06em">${esc(opts.id.toUpperCase())}</text>` : ""}
      ${lines ? `<text x="${x + 14}" y="${y + (opts.id ? 42 : 24)}" fill="${BRAND.carbon}" font-family="${BRAND.body}" font-size="${fs}">${lines}</text>` : ""}
    </g>`;
}

/** A small drawn warning glyph (no emoji) — a rounded triangle with a bang. */
export function warnGlyph(x: number, y: number, size = 16, color = "#C96B3A"): string {
  const s = size;
  return `
    <g transform="translate(${x},${y})">
      <path d="M ${s / 2} 1 L ${s - 1} ${s - 2} L 1 ${s - 2} Z" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" />
      <line x1="${s / 2}" y1="${s * 0.42}" x2="${s / 2}" y2="${s * 0.66}" stroke="${color}" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="${s / 2}" cy="${s * 0.8}" r="0.9" fill="${color}" />
    </g>`;
}

/** Wrap scene-drawn SVG markup in the <svg> element with an arrow marker def. */
export function svg(w: number, h: number, inner: string): string {
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${BRAND.amber}" />
        </marker>
      </defs>
      ${inner}
    </svg>`;
}
