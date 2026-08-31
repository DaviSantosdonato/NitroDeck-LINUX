use nitrodeck_core::HardwareSnapshot;
use nitrodeck_hardware::HardwareState;
use std::sync::Mutex;

#[tauri::command]
fn get_hardware_snapshot(state: tauri::State<Mutex<HardwareState>>) -> HardwareSnapshot {
    let mut state = state.lock().unwrap_or_else(|e| e.into_inner());
    nitrodeck_hardware::read_snapshot(&mut state)
}

#[tauri::command]
fn set_fan_speed(cpu: u8, gpu: u8) -> Result<(), String> {
    nitrodeck_hardware::fans::set_speed(cpu, gpu)
}

#[tauri::command]
fn set_generic_fan_pwm(id: String, percent: u8) -> Result<(), String> {
    nitrodeck_hardware::generic_fan::set_percent(&id, percent)
}

#[tauri::command]
fn set_battery_charge_limit(enabled: bool) -> Result<(), String> {
    nitrodeck_hardware::battery::set_charge_limit(enabled)
}

#[tauri::command]
fn set_battery_calibration(enabled: bool) -> Result<(), String> {
    nitrodeck_hardware::extras::set_group_toggle("battery_calibration", enabled)
}

#[tauri::command]
fn set_usb_charging(level: u8) -> Result<(), String> {
    nitrodeck_hardware::extras::set_usb_charging(level)
}

#[tauri::command]
fn set_extra_root_toggle(field: String, enabled: bool) -> Result<(), String> {
    nitrodeck_hardware::extras::set_root_toggle(&field, enabled)
}

#[tauri::command]
fn set_power_profile(id: String) -> Result<(), String> {
    nitrodeck_hardware::power::set_profile(&id)
}

#[tauri::command]
fn set_cpu_governor(governor: String) -> Result<(), String> {
    nitrodeck_hardware::cpu::set_governor(&governor)
}

#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    nitrodeck_hardware::processes::kill(pid)
}

#[tauri::command]
fn set_process_memory_limit(pid: u32, memory_mb: Option<u32>) -> Result<(), String> {
    nitrodeck_hardware::processes::set_memory_limit(pid, memory_mb)
}

#[tauri::command]
fn launch_with_limits(
    command: String,
    memory_mb: Option<u32>,
    cpu_percent: Option<u32>,
    gpu: Option<String>,
) -> Result<(), String> {
    nitrodeck_hardware::launcher::launch_with_limits(command, memory_mb, cpu_percent, gpu)
}

#[tauri::command]
fn set_cpu_turbo(enabled: bool) -> Result<(), String> {
    nitrodeck_hardware::cpu::set_turbo(enabled)
}

#[tauri::command]
fn set_cpu_power_limits(pl1_w: Option<f64>, pl2_w: Option<f64>) -> Result<(), String> {
    nitrodeck_hardware::cpu::set_power_limits(pl1_w, pl2_w)
}

#[tauri::command]
fn accept_hardware_risk() -> Result<(), String> {
    nitrodeck_hardware::model::accept_risk()
}

#[tauri::command]
fn revoke_hardware_risk() -> Result<(), String> {
    nitrodeck_hardware::model::revoke_risk()
}

#[tauri::command]
fn install_hardware_driver() -> Result<(), String> {
    nitrodeck_hardware::model::install_driver()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(HardwareState::default()))
        .invoke_handler(tauri::generate_handler![
            get_hardware_snapshot,
            set_fan_speed,
            set_battery_charge_limit,
            set_battery_calibration,
            set_usb_charging,
            set_extra_root_toggle,
            set_power_profile,
            set_cpu_governor,
            kill_process,
            launch_with_limits,
            set_cpu_turbo,
            set_cpu_power_limits,
            accept_hardware_risk,
            revoke_hardware_risk,
            install_hardware_driver,
            set_generic_fan_pwm,
            set_process_memory_limit
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            // Nunca deixar a ventoinha travada num valor manual se a janela
            // fechar, o processo receber Ctrl+C, etc. Melhor esforço: se o
            // processo for morto com SIGKILL isso não roda — mas o serviço
            // systemd `nitrodeck-fan-watchdog` (independente deste processo)
            // cobre esse caso, aplicando o piso de segurança em até 5s.
            if let tauri::RunEvent::ExitRequested { .. } = event {
                nitrodeck_hardware::fans::revert_to_auto_best_effort();
                nitrodeck_hardware::generic_fan::revert_all_to_auto_best_effort();
            }
        });
}
