//! Tipos compartilhados do NitroDeck Linux. Espelham `src/types/hardware.ts`
//! no frontend — os nomes dos campos são serializados em camelCase para
//! bater exatamente com os tipos TypeScript, sem precisar de um mapeamento
//! manual em nenhum dos dois lados.

use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderStatus {
    Ok,
    ReadOnly,
    Unavailable,
    Incompatible,
    DriverRequired,
    AwaitingValidation,
    Error,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMeta {
    pub status: ProviderStatus,
    pub read_only: bool,
    pub source: String,
    pub last_update: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl ProviderMeta {
    pub fn new(status: ProviderStatus, source: impl Into<String>) -> Self {
        Self {
            status,
            read_only: true,
            source: source.into(),
            last_update: now_ms(),
            detail: None,
        }
    }

    pub fn with_detail(mut self, detail: impl Into<String>) -> Self {
        self.detail = Some(detail.into());
        self
    }
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CpuReading {
    pub meta: ProviderMeta,
    pub model: String,
    pub cores: u32,
    pub threads: u32,
    pub usage_pct: Option<f64>,
    pub per_core_usage: Vec<f64>,
    pub freq_mhz: Option<f64>,
    pub package_temp_c: Option<f64>,
    pub package_power_w: Option<f64>,
    pub governor: Option<String>,
    pub available_governors: Vec<String>,
    /// `None` quando o kernel não expõe `intel_pstate/no_turbo` (ex.: CPU não-Intel).
    pub turbo_enabled: Option<bool>,
    pub power_limit_pl1_w: Option<f64>,
    pub power_limit_pl2_w: Option<f64>,
    pub power_limit_min_w: f64,
    pub power_limit_pl1_max_w: f64,
    pub power_limit_pl2_max_w: f64,
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "lowercase")]
pub enum GpuKind {
    Integrated,
    Discrete,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GpuReading {
    pub meta: ProviderMeta,
    pub name: String,
    pub kind: GpuKind,
    pub usage_pct: Option<f64>,
    pub vram_used_mb: Option<f64>,
    pub vram_total_mb: Option<f64>,
    pub temp_c: Option<f64>,
    pub power_w: Option<f64>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MemoryReading {
    pub meta: ProviderMeta,
    pub total_mb: f64,
    pub used_mb: f64,
    pub swap_total_mb: f64,
    pub swap_used_mb: f64,
}

#[derive(Serialize, Clone, Copy, Debug)]
#[serde(rename_all = "kebab-case")]
pub enum BatteryStatus {
    Charging,
    Discharging,
    Full,
    NotCharging,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct BatteryReading {
    pub meta: ProviderMeta,
    pub percent: f64,
    pub status: BatteryStatus,
    pub cycle_count: Option<u32>,
    pub health_pct: Option<f64>,
    pub power_now_w: Option<f64>,
    pub time_remaining_min: Option<f64>,
    pub charge_limit_supported: bool,
    pub charge_limit_enabled: Option<bool>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StorageDevice {
    pub name: String,
    pub model: String,
    pub size_gb: f64,
    pub used_pct: Option<f64>,
    pub temp_c: Option<f64>,
    pub wear_pct: Option<f64>,
    pub smart_ok: Option<bool>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct StorageReading {
    pub meta: ProviderMeta,
    pub devices: Vec<StorageDevice>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FanEntry {
    pub label: String,
    pub rpm: Option<f64>,
}

#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FanMode {
    Auto,
    Manual,
}

/// Um canal de ventoinha controlado via a interface hwmon `pwmN` padrão do
/// kernel (não específico de fabricante — ver `generic_fan.rs`).
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GenericPwmChannel {
    pub id: String,
    pub label: String,
    pub percent: Option<u8>,
    pub is_manual: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FanReading {
    pub meta: ProviderMeta,
    pub monitoring_available: bool,
    pub control_available: bool,
    pub fans: Vec<FanEntry>,
    pub mode: FanMode,
    pub cpu_percent: Option<u8>,
    pub gpu_percent: Option<u8>,
    pub min_manual_percent: u8,
    pub generic_pwm: Vec<GenericPwmChannel>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PowerProfile {
    pub id: String,
    pub label: String,
    pub active: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct PowerReading {
    pub meta: ProviderMeta,
    pub profiles: Vec<PowerProfile>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct KeyboardLightingReading {
    pub meta: ProviderMeta,
}

/// Um recurso liga/desliga exposto pelo linuwu_sense. `supported = false`
/// significa que o driver respondeu "-1" (recurso não existe neste
/// hardware) — nunca oferecemos controle nesse caso.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ToggleFeature {
    pub id: String,
    pub label: String,
    pub description: String,
    pub supported: bool,
    pub enabled: bool,
    pub requires_root: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct UsbChargingFeature {
    pub supported: bool,
    /// 0 = desligado, 10/20/30 = fornece energia até a bateria cair a esse %.
    pub level: u8,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ExtrasReading {
    pub meta: ProviderMeta,
    pub battery_calibration: ToggleFeature,
    pub backlight_timeout: ToggleFeature,
    pub boot_animation_sound: ToggleFeature,
    pub lcd_override: ToggleFeature,
    pub usb_charging: UsbChargingFeature,
}

/// Uma linha da lista de processos (via `ps`, somente leitura). `owned_by_user`
/// indica se o processo pertence ao usuário que está rodando o NitroDeck — só
/// esses podem ser encerrados pelo app; nunca escalamos privilégio para
/// mexer em processos de outro usuário ou do sistema.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessEntry {
    pub pid: u32,
    pub name: String,
    pub cpu_percent: f64,
    pub mem_percent: f64,
    pub mem_mb: f64,
    pub owned_by_user: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ProcessesReading {
    pub meta: ProviderMeta,
    pub processes: Vec<ProcessEntry>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub vendor: Option<String>,
    pub product_name: Option<String>,
    pub model_confirmed: bool,
    pub linuwu_sense_present: bool,
    pub controls_allowed: bool,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TempSensor {
    pub label: String,
    pub temp_c: f64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TemperaturesReading {
    pub meta: ProviderMeta,
    pub sensors: Vec<TempSensor>,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSnapshot {
    pub system: SystemInfo,
    pub cpu: CpuReading,
    pub gpu_integrated: GpuReading,
    pub gpu_discrete: GpuReading,
    pub memory: MemoryReading,
    pub battery: BatteryReading,
    pub storage: StorageReading,
    pub fans: FanReading,
    pub power: PowerReading,
    pub keyboard_lighting: KeyboardLightingReading,
    pub extras: ExtrasReading,
    pub processes: ProcessesReading,
    pub temperatures: TemperaturesReading,
}
