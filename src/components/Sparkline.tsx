import { useEffect, useRef } from "react";
import type { Sample } from "../types/hardware";

export function Sparkline({
  data,
  color = "var(--accent)",
  min = 0,
  max = 100,
  height = 44,
}: {
  data: Sample[];
  color?: string;
  min?: number;
  max?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(rect.width, 40);
    const h = height;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    if (data.length < 2) return;

    const resolvedColor = color.startsWith("var(")
      ? getComputedStyle(document.documentElement).getPropertyValue(color.slice(4, -1)).trim() || "#e11d48"
      : color;

    const xs = (i: number) => (i / (data.length - 1)) * w;
    const ys = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 4) - 2;

    ctx.beginPath();
    data.forEach((s, i) => {
      const x = xs(i);
      const y = ys(s.v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = resolvedColor;
    ctx.lineWidth = 1.75;
    ctx.lineJoin = "round";
    ctx.stroke();

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, resolvedColor + "33");
    grad.addColorStop(1, resolvedColor + "00");
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, color, min, max, height]);

  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}
