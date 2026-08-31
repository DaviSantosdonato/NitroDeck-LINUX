import { invoke } from "@tauri-apps/api/core";
import type {
  BatteryState,
  CpuState,
  ExtrasState,
  FanState,
  GpuState,
  HardwareSnapshot,
  KeyboardLightingState,
  MemoryState,
  PowerState,
  ProcessesState,
  ProviderMeta,
  Sample,
  StorageState,
  SystemInfo,
  TemperaturesState,
  ToggleFeature,
} from "../types/hardware";

// Ponte com o backend Rust (comando `get_hardware_snapshot`). O Rust nunca
// mantém histórico — cada chamada retorna só a leitura instantânea; o
// histórico usado nos gráficos é acumulado aqui, no cliente, para cada
// snapshot recebido.

type RawCpuState = Omit<CpuState, "history">;
type RawGpuState = Omit<GpuState, "history">;
type RawMemoryState = Omit<MemoryState, "history">;

interface RawHardwareSnapshot {
  system: SystemInfo;
  cpu: RawCpuState;
  gpuIntegrated: RawGpuState;
  gpuDiscrete: RawGpuState;
  memory: RawMemoryState;
  battery: BatteryState;
  storage: StorageState;
  fans: FanState;
  power: PowerState;
  keyboardLighting: KeyboardLightingState;
  extras: ExtrasState;
  processes: ProcessesState;
  temperatures: TemperaturesState;
}

const HISTORY_LEN = 90;

function pushSample(hist: Sample[], v: number | null): Sample[] {
  if (v == null) return hist;
  const next = [...hist, { t: Date.now(), v }];
  if (next.length > HISTORY_LEN) next.shift();
  return next;
}

function emptyMeta(): ProviderMeta {
  return { status: "awaiting-validation", readOnly: true, source: "—", lastUpdate: Date.now() };
}

export function emptySnapshot(): HardwareSnapshot {
  return {
    system: {
      vendor: null,
      productName: null,
      modelConfirmed: false,
      linuwuSensePresent: false,
      controlsAllowed: false,
    },
    cpu: {
      meta: emptyMeta(),
      model: "—",
      cores: 0,
      threads: 0,
      usagePct: null,
      perCoreUsage: [],
      freqMhz: null,
      packageTempC: null,
      packagePowerW: null,
      governor: null,
      availableGovernors: [],
      turboEnabled: null,
      powerLimitPl1W: null,
      powerLimitPl2W: null,
      powerLimitMinW: 10,
      powerLimitPl1MaxW: 65,
      powerLimitPl2MaxW: 140,
      history: [],
    },
    gpuIntegrated: {
      meta: emptyMeta(),
      name: "—",
      kind: "integrated",
      usagePct: null,
      vramUsedMb: null,
      vramTotalMb: null,
      tempC: null,
      powerW: null,
      history: [],
    },
    gpuDiscrete: {
      meta: emptyMeta(),
      name: "—",
      kind: "discrete",
      usagePct: null,
      vramUsedMb: null,
      vramTotalMb: null,
      tempC: null,
      powerW: null,
      history: [],
    },
    memory: { meta: emptyMeta(), totalMb: 0, usedMb: 0, swapTotalMb: 0, swapUsedMb: 0, history: [] },
    battery: {
      meta: emptyMeta(),
      percent: 0,
      status: "not-charging",
      cycleCount: 0,
      healthPct: 0,
      powerNowW: 0,
      timeRemainingMin: null,
      chargeLimitSupported: false,
      chargeLimitEnabled: null,
    },
    storage: { meta: emptyMeta(), devices: [] },
    fans: {
      meta: emptyMeta(),
      monitoringAvailable: false,
      controlAvailable: false,
      fans: [],
      mode: "auto",
      cpuPercent: null,
      gpuPercent: null,
      minManualPercent: 30,
      genericPwm: [],
    },
    power: { meta: emptyMeta(), profiles: [] },
    keyboardLighting: { meta: emptyMeta() },
    extras: {
      meta: emptyMeta(),
      batteryCalibration: emptyToggle("battery_calibration"),
      backlightTimeout: emptyToggle("backlight_timeout"),
      bootAnimationSound: emptyToggle("boot_animation_sound"),
      lcdOverride: emptyToggle("lcd_override"),
      usbCharging: { supported: false, level: 0 },
    },
    processes: { meta: emptyMeta(), processes: [] },
    temperatures: { meta: emptyMeta(), sensors: [] },
  };
}

function emptyToggle(id: string): ToggleFeature {
  return { id, label: id, description: "", supported: false, enabled: false, requiresRoot: false };
}

function mergeHistory(prev: HardwareSnapshot, raw: RawHardwareSnapshot): HardwareSnapshot {
  const memPct = raw.memory.totalMb > 0 ? (raw.memory.usedMb / raw.memory.totalMb) * 100 : null;
  return {
    ...raw,
    cpu: { ...raw.cpu, history: pushSample(prev.cpu.history, raw.cpu.usagePct) },
    gpuIntegrated: {
      ...raw.gpuIntegrated,
      history: pushSample(prev.gpuIntegrated.history, raw.gpuIntegrated.usagePct),
    },
    gpuDiscrete: {
      ...raw.gpuDiscrete,
      history: pushSample(prev.gpuDiscrete.history, raw.gpuDiscrete.usagePct),
    },
    memory: { ...raw.memory, history: pushSample(prev.memory.history, memPct) },
  };
}

export async function fetchSnapshot(prev: HardwareSnapshot): Promise<HardwareSnapshot> {
  const raw = await invoke<RawHardwareSnapshot>("get_hardware_snapshot");
  return mergeHistory(prev, raw);
}
