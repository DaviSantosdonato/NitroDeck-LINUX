import { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { Sample } from "../types/hardware";

export function Chart({
  data,
  color = "#e11d48",
  unit = "%",
  min = 0,
  max = 100,
  height = 220,
}: {
  data: Sample[];
  color?: string;
  unit?: string;
  min?: number;
  max?: number;
  height?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const opts: uPlot.Options = {
      width: hostRef.current.clientWidth,
      height,
      scales: { y: { range: [min, max] } },
      axes: [
        {
          stroke: "#7c7c85",
          grid: { stroke: "rgba(255,255,255,0.05)" },
          font: "11px Inter",
        },
        {
          stroke: "#7c7c85",
          grid: { stroke: "rgba(255,255,255,0.05)" },
          font: "11px Inter",
          values: (_u, vals) => vals.map((v) => `${v}${unit}`),
        },
      ],
      series: [
        {},
        {
          stroke: color,
          width: 1.75,
          fill: color + "1a",
          points: { show: false },
        },
      ],
      cursor: { show: true, points: { show: false } },
      legend: { show: false },
    };

    const plot = new uPlot(opts, toUplotData(data), hostRef.current);
    plotRef.current = plot;

    const resize = () => {
      if (hostRef.current) plot.setSize({ width: hostRef.current.clientWidth, height });
    };
    const ro = new ResizeObserver(resize);
    ro.observe(hostRef.current);

    return () => {
      ro.disconnect();
      plot.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    plotRef.current?.setData(toUplotData(data));
  }, [data]);

  return <div ref={hostRef} />;
}

function toUplotData(data: Sample[]): uPlot.AlignedData {
  return [data.map((s) => s.t / 1000), data.map((s) => s.v)];
}
