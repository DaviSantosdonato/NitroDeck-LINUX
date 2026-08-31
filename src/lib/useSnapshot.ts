import { useEffect, useRef, useState } from "react";
import { emptySnapshot, fetchSnapshot } from "./hardwareClient";
import type { HardwareSnapshot } from "../types/hardware";

export function useHardwareSnapshot(intervalMs = 1500) {
  const [snapshot, setSnapshot] = useState<HardwareSnapshot>(emptySnapshot);
  const ref = useRef(snapshot);
  ref.current = snapshot;

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const next = await fetchSnapshot(ref.current);
        if (!cancelled) setSnapshot(next);
      } catch (err) {
        console.error("Falha ao ler snapshot de hardware:", err);
      }
    }

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs]);

  return snapshot;
}
