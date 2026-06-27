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
    stage.innerHTML = opts.scene({ w, h }) + '<div id="handle" title="drag to resize">◢</div>';
    wireHandle();
    readout.textContent = `viewport ${Math.round(w)} × ${Math.round(h)} px — drag the ◢ corner to reflow`;
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
  gold: { stroke: "#f5a623", fill: "rgba(245,166,35,0.12)" },
  pink: { stroke: "#ec4899", fill: "rgba(236,72,153,0.12)" },
  green: { stroke: "#4ade80", fill: "rgba(74,222,128,0.12)" },
  blue: { stroke: "#38bdf8", fill: "rgba(56,189,248,0.12)" },
  slate: { stroke: "#505068", fill: "rgba(80,80,104,0.15)" },
};

export type Tone = keyof typeof PALETTE;

/** Draw one card box with an id badge and optional wrapped text lines. */
export function card(
  box: { x: number; y: number; w: number; h: number },
  opts: { id?: string; tone?: Tone; lines?: string[]; fontSize?: number } = {},
): string {
  const { x, y, w, h } = box;
  const c = PALETTE[opts.tone ?? "slate"];
  const fs = opts.fontSize ?? 13;
  const lines = (opts.lines ?? [])
    .map((ln, i) => `<tspan x="${x + 14}" dy="${i === 0 ? 0 : fs * 1.4}">${esc(ln)}</tspan>`)
    .join("");
  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${c.fill}" stroke="${c.stroke}" stroke-width="2" />
      ${opts.id ? `<text x="${x + 14}" y="${y + 22}" fill="${c.stroke}" font-family="ui-monospace, monospace" font-size="11" font-weight="700">${esc(opts.id)}</text>` : ""}
      ${lines ? `<text x="${x + 14}" y="${y + (opts.id ? 42 : 24)}" fill="#e2e8f0" font-family="sans-serif" font-size="${fs}">${lines}</text>` : ""}
    </g>`;
}

/** Wrap scene-drawn SVG markup in the <svg> element with grid background + arrow marker. */
export function svg(w: number, h: number, inner: string): string {
  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
      </defs>
      ${inner}
    </svg>`;
}
