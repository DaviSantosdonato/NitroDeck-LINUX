// Tipos espelham a arquitetura de providers do NitroDeck (nitrodeck-core,
// crates/nitrodeck-core/src/lib.rs). Os dados vêm de leituras reais via
// `src/lib/hardwareClient.ts`. A UI trata cada provider pelo seu `status`,
// nunca assume disponibilidade.

export type ProviderStatus =
  | "ok" // lendo normalmente
  | "read-only" // leitura ok, escrita/controle não oferecido nesta versão
  | "unavailable" // recurso não existe neste hardware
  | "incompatible" // hardware não suportado / não validado
  | "driver-required" // falta driver compatível
  | "awaiting-validation" // aguardando confirmação de modelo/registradores
  | "error"; // fonte retornou dado incoerente

export interface ProviderMeta {
  status: ProviderStatus;
  readOnly: boolean;
  source: string;
  lastUpdate: number; // epoch ms
  detail?: string;
}

export interface Sample {
  t: number;
  v: number;
}

export interface CpuState {
  meta: ProviderMeta;
  model: string;
  cores: number;
  threads: number;
  usagePct: number | null;
  perCoreUsage: number[];
  freqMhz: number | null;
  packageTempC: number | null;
  packagePowerW: number | null;
  governor: string | null;
  availableGovernors: string[];
  turboEnabled: boolean | null;
  powerLimitPl1W: number | null;
  powerLimitPl2W: number | null;
  powerLimitMinW: number;
  powerLimitPl1MaxW: number;
  powerLimitPl2MaxW: number;
  history: Sample[];
}

export interface GpuState {
  meta: ProviderMeta;
  name: string;
  kind: "integrated" | "discrete";
  usagePct: number | null;
  vramUsedMb: number | null;
  vramTotalMb: number | null;
  tempC: number | null;
  powerW: number | null;
  history: Sample[];
}

export interface MemoryState {
  meta: ProviderMeta;
  totalMb: number;
  usedMb: number;
  swapTotalMb: number;
  swapUsedMb: number;
  history: Sample[];
}

export interface BatteryState {
  meta: ProviderMeta;
  percent: number;
  status: "charging" | "discharging" | "full" | "not-charging";
  cycleCount: number;
  healthPct: number;
  powerNowW: number;
  timeRemainingMin: number | null;
  chargeLimitSupported: boolean;
  chargeLimitEnabled: boolean | null;
}

export interface StorageDevice {
  name: string;
  model: string;
  sizeGb: number;
  usedPct: number;
  tempC: number | null;
  wearPct: number | null;
  smartOk: boolean | null;
}

export interface StorageState {
  meta: ProviderMeta;
  devices: StorageDevice[];
}

export interface FanState {
  meta: ProviderMeta;
  monitoringAvailable: boolean;
  controlAvailable: boolean;
  fans: { label: string; rpm: number | null }[];
  mode: "auto" | "manual";
  cpuPercent: number | null;
  gpuPercent: number | null;
  minManualPercent: number;
}

export interface PowerProfile {
  id: "power-saver" | "balanced" | "performance";
  label: string;
  active: boolean;
}

export interface PowerState {
  meta: ProviderMeta;
  profiles: PowerProfile[];
}

export interface KeyboardLightingState {
  meta: ProviderMeta;
}

export interface ToggleFeature {
  id: string;
  label: string;
  description: string;
  supported: boolean;
  enabled: boolean;
  requiresRoot: boolean;
}

export interface UsbChargingFeature {
  supported: boolean;
  level: 0 | 10 | 20 | 30;
}

export interface ExtrasState {
  meta: ProviderMeta;
  batteryCalibration: ToggleFeature;
  backlightTimeout: ToggleFeature;
  bootAnimationSound: ToggleFeature;
  lcdOverride: ToggleFeature;
  usbCharging: UsbChargingFeature;
}

export interface ProcessEntry {
  pid: number;
  name: string;
  cpuPercent: number;
  memPercent: number;
  memMb: number;
  ownedByUser: boolean;
}

export interface ProcessesState {
  meta: ProviderMeta;
  processes: ProcessEntry[];
}

export interface TempSensor {
  label: string;
  tempC: number;
}

export interface TemperaturesState {
  meta: ProviderMeta;
  sensors: TempSensor[];
}

export interface HardwareSnapshot {
  cpu: CpuState;
  gpuIntegrated: GpuState;
  gpuDiscrete: GpuState;
  memory: MemoryState;
  battery: BatteryState;
  storage: StorageState;
  fans: FanState;
  power: PowerState;
  keyboardLighting: KeyboardLightingState;
  extras: ExtrasState;
  processes: ProcessesState;
  temperatures: TemperaturesState;
}

export const STATUS_LABEL: Record<ProviderStatus, string> = {
  ok: "Monitorando",
  "read-only": "Somente monitoramento",
  unavailable: "Recurso indisponível",
  incompatible: "Hardware não compatível",
  "driver-required": "Driver necessário",
  "awaiting-validation": "Aguardando validação",
  error: "Leitura incoerente",
};
