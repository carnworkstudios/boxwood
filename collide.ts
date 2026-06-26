import type { LBox, ResolvedLNode } from "./types.js";

function isAncestor(ancestor: ResolvedLNode, node: ResolvedLNode): boolean {
  let cur: ResolvedLNode | undefined = node.parent;
  while (cur) {
    if (cur === ancestor) return true;
    cur = cur.parent;
  }
  return false;
}

function boxesOverlap(a: LBox, b: LBox): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function overlapArea(a: LBox, b: LBox): number {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

const NUDGE_DISTANCE = 10;
const MAX_PASSES = 5;

export function resolveCollisions(
  resolvedNodes: ResolvedLNode[],
  world: LBox,
): void {
  if (resolvedNodes.length < 2) return;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let anyCollision = false;

    for (let i = 0; i < resolvedNodes.length; i++) {
      for (let j = i + 1; j < resolvedNodes.length; j++) {
        const ni = resolvedNodes[i];
        const nj = resolvedNodes[j];
        if (isAncestor(ni, nj) || isAncestor(nj, ni)) continue;
        if (!boxesOverlap(ni.box, nj.box)) continue;
        anyCollision = true;

        const a = ni.box;
        const b = nj.box;
        const area = overlapArea(a, b);

        const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        const nudgeX = overlapW < overlapH ? NUDGE_DISTANCE : 0;
        const nudgeY = overlapW >= overlapH ? NUDGE_DISTANCE : 0;

        if (nudgeX !== 0) {
          if (a.x < b.x) b.x += nudgeX;
          else a.x += nudgeX;
        }
        if (nudgeY !== 0) {
          if (a.y < b.y) b.y += nudgeY;
          else a.y += nudgeY;
        }
      }
    }

    if (!anyCollision) break;
  }

  for (const rn of resolvedNodes) {
    rn.box.x = Math.max(0, Math.min(rn.box.x, world.w - rn.box.w));
    rn.box.y = Math.max(0, Math.min(rn.box.y, world.h - rn.box.h));
  }
}
