/**
 * Pure geometry behind the login screen's constellation background.
 *
 * Kept separate from the React component (and free of canvas/DOM) so the
 * motion can be unit-tested — the same split the pipeline uses for
 * classification-rules.ts and resolution-rules.ts.
 *
 * Colour, density and node size are measured from the live yunoai.io
 * `canvas.particle-layer`: nodes rgb(107,122,255) at 42% alpha, links the
 * same hue at ~5–9%, roughly one node per 17,400 css px², node diameter
 * 1–5px.
 */

export const NODE_RGB = "107, 122, 255";
export const NODE_ALPHA = 0.42;
export const LINK_ALPHA = 0.09;
export const LINK_DISTANCE = 180;
export const PX2_PER_NODE = 17_400;
export const MAX_NODES = 110;
/** css px per frame — slow enough that a node takes minutes to cross the screen. */
export const DRIFT = 0.05;

export interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export function nodeCountFor(width: number, height: number): number {
  return Math.min(MAX_NODES, Math.round((width * height) / PX2_PER_NODE));
}

export function createNodes(
  width: number,
  height: number,
  random: () => number = Math.random
): Node[] {
  return Array.from({ length: nodeCountFor(width, height) }, () => ({
    x: random() * width,
    y: random() * height,
    vx: (random() - 0.5) * 2 * DRIFT,
    vy: (random() - 0.5) * 2 * DRIFT,
    r: 0.6 + random() * 1.9,
  }));
}

/**
 * Advances every node by one frame, wrapping it to the opposite edge once it
 * drifts a full link-distance out of view — without the wrap the field would
 * slowly thin out on one side.
 */
export function stepNodes(nodes: Node[], width: number, height: number): void {
  const margin = LINK_DISTANCE;
  for (const n of nodes) {
    n.x += n.vx;
    n.y += n.vy;
    if (n.x < -margin) n.x = width + margin;
    else if (n.x > width + margin) n.x = -margin;
    if (n.y < -margin) n.y = height + margin;
    else if (n.y > height + margin) n.y = -margin;
  }
}

/** Links fade out as their two nodes drift apart; beyond LINK_DISTANCE there is no line. */
export function linkOpacity(distance: number): number {
  if (distance > LINK_DISTANCE) return 0;
  return LINK_ALPHA * (1 - distance / LINK_DISTANCE);
}
