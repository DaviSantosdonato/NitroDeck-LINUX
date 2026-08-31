//! Adapters de hardware. A maioria dos módulos é somente-leitura: lê
//! diretamente de procfs/sysfs ou de um comando de sistema já usado sem
//! privilégio (lspci, df, powerprofilesctl), nunca como root.
//!
//! `fans::set_speed` é a única exceção — escreve no controle de ventoinha
//! exposto pelo módulo de kernel `linuwu_sense` (instalado fora do
//! NitroDeck, confirmado apenas para o Acer Nitro ANV15-52). Toda escrita
//! valida o modelo do notebook e a faixa segura antes de tocar no arquivo;
//! nunca escala privilégio (usa o grupo suplementar do próprio usuário via
//! `sg`, nunca root).

pub mod battery;
pub mod cpu;
pub mod extras;
pub mod fans;
pub mod generic_fan;
mod gpu;
mod hwmon;
mod keyboard;
pub mod launcher;
mod nvml;
mod memory;
pub mod model;
pub mod power;
pub mod processes;
mod sg;
mod storage;
pub mod temperatures;

use nitrodeck_core::{HardwareSnapshot, SystemInfo};

#[derive(Default)]
pub struct HardwareState {
    cpu: cpu::CpuState,
}

pub fn read_snapshot(state: &mut HardwareState) -> HardwareSnapshot {
    HardwareSnapshot {
        system: SystemInfo {
            vendor: model::vendor(),
            product_name: model::product_name(),
            model_confirmed: model::is_confirmed(),
            linuwu_sense_present: model::linuwu_sense_present(),
            controls_allowed: model::controls_allowed(),
        },
        cpu: cpu::read(&mut state.cpu),
        gpu_integrated: gpu::read_integrated(),
        gpu_discrete: gpu::read_discrete(),
        memory: memory::read(),
        battery: battery::read(),
        storage: storage::read(),
        fans: fans::read(),
        power: power::read(),
        keyboard_lighting: keyboard::read(),
        extras: extras::read(),
        processes: processes::read(),
        temperatures: temperatures::read(),
    }
}
