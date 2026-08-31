use nitrodeck_core::{GpuKind, GpuReading, ProviderMeta, ProviderStatus};
use std::process::Command;

struct PciGpu {
    /// Barramento PCI (parte antes do primeiro ":", ex.: "00" em "00:02.0").
    /// GPU integrada está sempre no barramento raiz ("00"); qualquer outro
    /// valor é uma placa dedicada, real (PCIe) — isso vale pra qualquer
    /// fabricante, então não precisamos adivinhar pelo nome do vendor.
    bus: String,
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
                let address = line.split_whitespace().next().unwrap_or("");
                let bus = address.split(':').next().unwrap_or("").to_string();
                if let Some(desc) = line.splitn(2, ": ").nth(1) {
                    current = Some(PciGpu {
                        bus,
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

fn is_integrated_bus(bus: &str) -> bool {
    bus == "00"
}

fn telemetry_for(driver: Option<&str>) -> (Option<f64>, Option<f64>, Option<f64>, Option<f64>, Option<f64>, String) {
    match driver {
        Some("nvidia") => match crate::nvml::read() {
            Some(n) => (
                n.gpu_util_pct,
                n.vram_used_mb,
                n.vram_total_mb,
                n.temp_c,
                n.power_w,
                "lspci -nnk, NVML".to_string(),
            ),
            None => (None, None, None, None, None, "lspci -nnk".to_string()),
        },
        Some("amdgpu") => match crate::amdgpu::read() {
            Some(a) => (
                a.gpu_util_pct,
                a.vram_used_mb,
                a.vram_total_mb,
                a.temp_c,
                a.power_w,
                "lspci -nnk, sysfs amdgpu".to_string(),
            ),
            None => (None, None, None, None, None, "lspci -nnk".to_string()),
        },
        _ => (None, None, None, None, None, "lspci -nnk".to_string()),
    }
}

pub fn read_integrated() -> GpuReading {
    let gpus = read_pci_gpus();
    let integrated = gpus.iter().find(|g| is_integrated_bus(&g.bus));

    match integrated {
        Some(g) => {
            let has_driver = matches!(g.driver.as_deref(), Some("i915") | Some("xe") | Some("amdgpu"));
            let status = if has_driver {
                ProviderStatus::ReadOnly
            } else {
                ProviderStatus::DriverRequired
            };
            let (usage_pct, vram_used_mb, vram_total_mb, temp_c, power_w, source) =
                telemetry_for(g.driver.as_deref());
            let detail = if g.driver.as_deref() == Some("amdgpu") {
                None
            } else {
                Some("Uso em % não disponível sem ferramentas privilegiadas (ex.: intel_gpu_top); frequência é lida quando exposta pelo driver.".to_string())
            };
            let mut meta = ProviderMeta::new(status, source);
            if let Some(d) = detail {
                meta = meta.with_detail(d);
            }
            GpuReading {
                meta,
                name: g.desc.clone(),
                kind: GpuKind::Integrated,
                usage_pct,
                vram_used_mb,
                vram_total_mb,
                temp_c,
                power_w,
            }
        }
        None => GpuReading {
            meta: ProviderMeta::new(ProviderStatus::Unavailable, "lspci -nnk")
                .with_detail("Nenhuma GPU integrada detectada via lspci."),
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
    let discrete = gpus.iter().find(|g| !is_integrated_bus(&g.bus));

    match discrete {
        Some(g) => {
            let driver_ok = matches!(g.driver.as_deref(), Some("nvidia") | Some("amdgpu"));
            let status = if driver_ok {
                ProviderStatus::ReadOnly
            } else {
                ProviderStatus::DriverRequired
            };
            let detail = match &g.driver {
                Some(d) if !driver_ok => Some(format!(
                    "Driver ativo atualmente é \"{d}\", que não expõe telemetria completa para esta GPU. Sem driver compatível instalado, esta seção fica limitada a identificação do hardware."
                )),
                None => Some("Nenhum driver de kernel vinculado a esta GPU.".to_string()),
                _ => None,
            };

            let (usage_pct, vram_used_mb, vram_total_mb, temp_c, power_w, source) =
                telemetry_for(g.driver.as_deref());

            let mut meta = ProviderMeta::new(status, source);
            if let Some(d) = detail {
                meta = meta.with_detail(d);
            }

            GpuReading {
                meta,
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
