use nitrodeck_core::{GpuKind, GpuReading, ProviderMeta, ProviderStatus};
use std::process::Command;

struct PciGpu {
    desc: String,
    driver: Option<String>,
}

fn strip_pci_id(desc: &str) -> String {
    // remove um sufixo "[xxxx:yyyy]" (o id vendor:device do PCI), se houver
    if let Some(pos) = desc.rfind('[') {
        let tail = &desc[pos..];
        if tail.len() == 11 && tail.starts_with('[') && tail.ends_with(']') {
            return desc[..pos].trim().to_string();
        }
    }
    desc.trim().to_string()
}

fn read_pci_gpus() -> Vec<PciGpu> {
    let Ok(output) = Command::new("lspci").arg("-nnk").output() else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }
    let text = String::from_utf8_lossy(&output.stdout);

    let mut gpus = Vec::new();
    let mut current: Option<PciGpu> = None;

    for line in text.lines() {
        let is_indented = line.starts_with(' ') || line.starts_with('\t');
        if !is_indented {
            if let Some(g) = current.take() {
                gpus.push(g);
            }
            let is_gpu_line = line.contains("VGA compatible controller")
                || line.contains("3D controller")
                || line.contains("Display controller");
            if is_gpu_line {
                if let Some(desc) = line.splitn(2, ": ").nth(1) {
                    current = Some(PciGpu {
                        desc: strip_pci_id(desc),
                        driver: None,
                    });
                }
            }
        } else if let Some(g) = current.as_mut() {
            if let Some(rest) = line.trim().strip_prefix("Kernel driver in use:") {
                g.driver = Some(rest.trim().to_string());
            }
        }
    }
    if let Some(g) = current.take() {
        gpus.push(g);
    }
    gpus
}

pub fn read_integrated() -> GpuReading {
    let gpus = read_pci_gpus();
    let intel = gpus
        .iter()
        .find(|g| g.desc.contains("Intel") && g.driver.as_deref() != Some("nouveau"));

    match intel {
        Some(g) => {
            let has_driver = g.driver.as_deref() == Some("i915") || g.driver.as_deref() == Some("xe");
            let status = if has_driver {
                ProviderStatus::ReadOnly
            } else {
                ProviderStatus::DriverRequired
            };
            GpuReading {
                meta: ProviderMeta::new(status, "lspci -nnk, /sys/class/drm")
                    .with_detail("Uso em % não disponível sem ferramentas privilegiadas (ex.: intel_gpu_top); frequência é lida quando exposta pelo driver."),
                name: g.desc.clone(),
                kind: GpuKind::Integrated,
                usage_pct: None,
                vram_used_mb: None,
                vram_total_mb: None,
                temp_c: None,
                power_w: None,
            }
        }
        None => GpuReading {
            meta: ProviderMeta::new(ProviderStatus::Unavailable, "lspci -nnk")
                .with_detail("Nenhuma GPU integrada Intel detectada via lspci."),
            name: "GPU integrada não detectada".into(),
            kind: GpuKind::Integrated,
            usage_pct: None,
            vram_used_mb: None,
            vram_total_mb: None,
            temp_c: None,
            power_w: None,
        },
    }
}

pub fn read_discrete() -> GpuReading {
    let gpus = read_pci_gpus();
    let discrete = gpus.iter().find(|g| {
        g.desc.contains("NVIDIA") || g.desc.contains("AMD") || g.desc.contains("Radeon")
    });

    match discrete {
        Some(g) => {
            let driver_ok = matches!(g.driver.as_deref(), Some("nvidia") | Some("amdgpu"));
            let status = if driver_ok {
                ProviderStatus::ReadOnly
            } else {
                ProviderStatus::DriverRequired
            };
            let detail = match &g.driver {
                Some(d) if !driver_ok => format!(
                    "Driver ativo atualmente é \"{d}\", que não expõe telemetria completa para esta GPU. Sem driver compatível instalado, esta seção fica limitada a identificação do hardware."
                ),
                None => "Nenhum driver de kernel vinculado a esta GPU.".to_string(),
                _ => String::new(),
            };

            let nvml = if g.driver.as_deref() == Some("nvidia") {
                crate::nvml::read()
            } else {
                None
            };
            let has_nvml = nvml.is_some();
            let (usage_pct, vram_used_mb, vram_total_mb, temp_c, power_w) = match nvml {
                Some(n) => (n.gpu_util_pct, n.vram_used_mb, n.vram_total_mb, n.temp_c, n.power_w),
                None => (None, None, None, None, None),
            };
            let source = if has_nvml {
                "lspci -nnk, NVML".to_string()
            } else {
                "lspci -nnk".to_string()
            };

            GpuReading {
                meta: if detail.is_empty() {
                    ProviderMeta::new(status, source)
                } else {
                    ProviderMeta::new(status, source).with_detail(detail)
                },
                name: g.desc.clone(),
                kind: GpuKind::Discrete,
                usage_pct,
                vram_used_mb,
                vram_total_mb,
                temp_c,
                power_w,
            }
        }
        None => GpuReading {
            meta: ProviderMeta::new(ProviderStatus::Unavailable, "lspci -nnk")
                .with_detail("Nenhuma GPU dedicada detectada via lspci."),
            name: "Nenhuma GPU dedicada".into(),
            kind: GpuKind::Discrete,
            usage_pct: None,
            vram_used_mb: None,
            vram_total_mb: None,
            temp_c: None,
            power_w: None,
        },
    }
}
