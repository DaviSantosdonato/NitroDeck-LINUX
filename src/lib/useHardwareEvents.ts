import { useEffect, useRef, useState } from "react";
import { createElement } from "react";
import { BatteryMedium, Cpu, Fan, ShieldCheck, Thermometer, Zap } from "lucide-react";
import type { HardwareSnapshot } from "../types/hardware";
import type { HardwareEvent } from "../components/EventFeed";

const HIGH_TEMP_C = 85;
const MAX_EVENTS = 30;

/**
 * Observa o snapshot em tempo real e gera eventos só quando algo realmente
 * muda — nunca sintetiza um evento a partir de um valor que não mudou.
 * Compara sempre com a leitura anterior (nunca com um "estado esperado"),
 * então mesmo se o app perder e recuperar o foco, não gera evento falso.
 */
export function useHardwareEvents(snap: HardwareSnapshot): HardwareEvent[] {
  const [events, setEvents] = useState<HardwareEvent[]>([]);
  const prevRef = useRef<HardwareSnapshot | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = snap;
    if (!prev) return;

    const now = Date.now();
    const next: HardwareEvent[] = [];
    const push = (id: string, icon: HardwareEvent["icon"], message: string, tone: HardwareEvent["tone"], detail?: string) => {
      next.push({ id: `${id}-${now}`, icon, message, detail, timestamp: now, tone });
    };

    if (prev.fans.mode !== snap.fans.mode) {
      push(
        "fan-mode",
        createElement(Fan, { size: 12 }),
        snap.fans.mode === "manual" ? "Ventoinha em modo manual" : "Ventoinha voltou ao automático",
        snap.fans.mode === "manual" ? "warn" : "good",
      );
    }

    const prevProfile = prev.power.profiles.find((p) => p.active)?.label;
    const curProfile = snap.power.profiles.find((p) => p.active)?.label;
    if (prevProfile && curProfile && prevProfile !== curProfile) {
      push("power-profile", createElement(Zap, { size: 12 }), `Perfil de energia mudou para ${curProfile}`, "neutral");
    }

    if (
      prev.battery.chargeLimitEnabled !== null &&
      snap.battery.chargeLimitEnabled !== null &&
      prev.battery.chargeLimitEnabled !== snap.battery.chargeLimitEnabled
    ) {
      push(
        "battery-limit",
        createElement(BatteryMedium, { size: 12 }),
        snap.battery.chargeLimitEnabled ? "Limite de carga (80%) ativado" : "Limite de carga desativado",
        "neutral",
      );
    }

    if (prev.temperatures.sensors.length > 0 && snap.temperatures.sensors.length > 0) {
      const prevMax = Math.max(...prev.temperatures.sensors.map((s) => s.tempC));
      const curMax = Math.max(...snap.temperatures.sensors.map((s) => s.tempC));
      if (prevMax < HIGH_TEMP_C && curMax >= HIGH_TEMP_C) {
        push(
          "temp-high",
          createElement(Thermometer, { size: 12 }),
          `Temperatura alta: ${curMax.toFixed(0)}°C`,
          "bad",
        );
      } else if (prevMax >= HIGH_TEMP_C && curMax < HIGH_TEMP_C) {
        push("temp-normal", createElement(Thermometer, { size: 12 }), "Temperatura voltou à faixa normal", "good");
      }
    }

    if (!prev.system.linuwuSensePresent && snap.system.linuwuSensePresent) {
      push("driver-loaded", createElement(Cpu, { size: 12 }), "Driver linuwu_sense carregado", "good");
    }

    if (!prev.system.controlsAllowed && snap.system.controlsAllowed) {
      push(
        "controls-unlocked",
        createElement(ShieldCheck, { size: 12 }),
        "Controles de hardware liberados",
        "good",
      );
    }

    if (next.length > 0) {
      setEvents((prevEvents) => [...next, ...prevEvents].slice(0, MAX_EVENTS));
    }
  }, [snap]);

  return events;
}
