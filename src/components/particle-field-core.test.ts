import { describe, expect, it } from "vitest";
import {
  createNodes,
  linkOpacity,
  nodeCountFor,
  stepNodes,
  DRIFT,
  LINK_ALPHA,
  LINK_DISTANCE,
  MAX_NODES,
  type Node,
} from "./particle-field-core";

// The animation itself can't be observed in an automated browser pane —
// requestAnimationFrame is paused while the document is hidden — so the
// motion is verified here, on the pure geometry the component drives.

describe("node seeding", () => {
  it("scales the node count with the canvas area", () => {
    expect(nodeCountFor(1280, 720)).toBeGreaterThan(nodeCountFor(640, 360));
  });

  it("matches the density measured on yunoai.io (~53 nodes at 1280x720)", () => {
    expect(nodeCountFor(1280, 720)).toBeCloseTo(53, -1);
  });

  it("caps the node count so a huge canvas can't stall the frame loop", () => {
    expect(nodeCountFor(10_000, 10_000)).toBe(MAX_NODES);
  });

  it("places every node inside the canvas", () => {
    const nodes = createNodes(800, 600);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(800);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(600);
    }
  });

  it("gives each node a drift no faster than DRIFT per axis", () => {
    for (const n of createNodes(800, 600)) {
      expect(Math.abs(n.vx)).toBeLessThanOrEqual(DRIFT);
      expect(Math.abs(n.vy)).toBeLessThanOrEqual(DRIFT);
    }
  });
});

describe("stepNodes", () => {
  it("moves each node by its velocity", () => {
    const nodes: Node[] = [{ x: 100, y: 100, vx: 0.05, vy: -0.03, r: 1 }];
    stepNodes(nodes, 800, 600);
    expect(nodes[0].x).toBeCloseTo(100.05);
    expect(nodes[0].y).toBeCloseTo(99.97);
  });

  it("actually displaces a freshly seeded field over many frames", () => {
    const nodes = createNodes(800, 600);
    const before = nodes.map((n) => ({ x: n.x, y: n.y }));
    for (let i = 0; i < 120; i++) stepNodes(nodes, 800, 600);
    const moved = nodes.filter(
      (n, i) => Math.abs(n.x - before[i].x) > 0.1 || Math.abs(n.y - before[i].y) > 0.1
    );
    expect(moved.length).toBe(nodes.length);
  });

  it("wraps a node that drifts off the right edge back to the left", () => {
    const nodes: Node[] = [{ x: 800 + LINK_DISTANCE, y: 300, vx: 1, vy: 0, r: 1 }];
    stepNodes(nodes, 800, 600);
    expect(nodes[0].x).toBe(-LINK_DISTANCE);
  });

  it("wraps a node that drifts off the top edge back to the bottom", () => {
    const nodes: Node[] = [{ x: 400, y: -LINK_DISTANCE, vx: 0, vy: -1, r: 1 }];
    stepNodes(nodes, 800, 600);
    expect(nodes[0].y).toBe(600 + LINK_DISTANCE);
  });

  it("keeps every node within the wrap margin no matter how long it runs", () => {
    const nodes = createNodes(800, 600);
    for (let i = 0; i < 20_000; i++) stepNodes(nodes, 800, 600);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(-LINK_DISTANCE - 1);
      expect(n.x).toBeLessThanOrEqual(800 + LINK_DISTANCE + 1);
      expect(n.y).toBeGreaterThanOrEqual(-LINK_DISTANCE - 1);
      expect(n.y).toBeLessThanOrEqual(600 + LINK_DISTANCE + 1);
    }
  });
});

describe("linkOpacity", () => {
  it("is strongest for touching nodes", () => {
    expect(linkOpacity(0)).toBeCloseTo(LINK_ALPHA);
  });

  it("fades to nothing at the link distance", () => {
    expect(linkOpacity(LINK_DISTANCE)).toBe(0);
  });

  it("draws no line at all beyond the link distance", () => {
    expect(linkOpacity(LINK_DISTANCE + 1)).toBe(0);
  });

  it("falls off as nodes drift apart", () => {
    expect(linkOpacity(40)).toBeGreaterThan(linkOpacity(120));
  });
});
