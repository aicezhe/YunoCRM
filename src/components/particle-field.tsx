"use client";

import { useEffect, useRef } from "react";
import {
  createNodes,
  linkOpacity,
  stepNodes,
  LINK_DISTANCE,
  NODE_ALPHA,
  NODE_RGB,
  type Node,
} from "./particle-field-core";

/**
 * The dots-and-lines constellation from yunoai.io's hero, rendered on a
 * canvas behind the login card. Geometry and constants live in
 * ./particle-field-core.ts; this component only owns the canvas, the
 * animation loop and resize handling.
 *
 * Under `prefers-reduced-motion` the field is drawn once and left static.
 */
export function ParticleField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let nodes: Node[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    function seed() {
      const rect = canvas!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;

      const dpr = window.devicePixelRatio || 1;
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

      nodes = createNodes(width, height);
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // Links first, so the nodes sit on top of them.
      ctx!.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          if (Math.abs(dx) > LINK_DISTANCE || Math.abs(dy) > LINK_DISTANCE) continue;
          const alpha = linkOpacity(Math.hypot(dx, dy));
          if (alpha === 0) continue;
          ctx!.strokeStyle = `rgba(${NODE_RGB}, ${alpha})`;
          ctx!.beginPath();
          ctx!.moveTo(nodes[i].x, nodes[i].y);
          ctx!.lineTo(nodes[j].x, nodes[j].y);
          ctx!.stroke();
        }
      }

      ctx!.fillStyle = `rgba(${NODE_RGB}, ${NODE_ALPHA})`;
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function tick() {
      stepNodes(nodes, width, height);
      draw();
      frame = requestAnimationFrame(tick);
    }

    seed();
    draw();
    if (!reduceMotion) frame = requestAnimationFrame(tick);

    function handleResize() {
      seed();
      draw();
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className} />;
}
