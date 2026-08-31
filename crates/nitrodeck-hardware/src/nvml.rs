use std::collections::HashMap;
use std::process::Command;

/// Leitura real da GPU NVIDIA via NVML (libnvidia-ml.so), chamada através de
/// um script Python curto com ctypes. Preferimos isso a `nvidia-smi` porque
/// o pacote `nvidia-smi` do repositório oficial da NVIDIA para Debian 13
/// está vazio (só metadados, sem o binário) — bug do empacotamento deles,
/// não nosso. NVML é a mesma biblioteca que o `nvidia-smi` usaria por baixo.
pub struct NvmlReading {
    pub temp_c: Option<f64>,
    pub gpu_util_pct: Option<f64>,
    pub vram_used_mb: Option<f64>,
    pub vram_total_mb: Option<f64>,
    pub power_w: Option<f64>,
}

const SCRIPT: &str = r#"
import ctypes
try:
    lib = ctypes.CDLL("libnvidia-ml.so.1")
    if lib.nvmlInit_v2() != 0:
        raise SystemExit(1)
    handle = ctypes.c_void_p()
    lib.nvmlDeviceGetHandleByIndex_v2(0, ctypes.byref(handle))

    temp = ctypes.c_uint()
    if lib.nvmlDeviceGetTemperature(handle, 0, ctypes.byref(temp)) == 0:
        print(f"temp_c={temp.value}")

    class Util(ctypes.Structure):
        _fields_ = [("gpu", ctypes.c_uint), ("memory", ctypes.c_uint)]
    u = Util()
    if lib.nvmlDeviceGetUtilizationRates(handle, ctypes.byref(u)) == 0:
        print(f"gpu_util_pct={u.gpu}")

    class MemInfo(ctypes.Structure):
        _fields_ = [("total", ctypes.c_ulonglong), ("free", ctypes.c_ulonglong), ("used", ctypes.c_ulonglong)]
    m = MemInfo()
    if lib.nvmlDeviceGetMemoryInfo(handle, ctypes.byref(m)) == 0:
        print(f"vram_used_mb={m.used/1024/1024}")
        print(f"vram_total_mb={m.total/1024/1024}")

    power = ctypes.c_uint()
    if lib.nvmlDeviceGetPowerUsage(handle, ctypes.byref(power)) == 0:
        print(f"power_w={power.value/1000}")

    lib.nvmlShutdown()
except Exception:
    raise SystemExit(1)
"#;

pub fn read() -> Option<NvmlReading> {
    let output = Command::new("python3").arg("-c").arg(SCRIPT).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let map: HashMap<&str, &str> = text
        .lines()
        .filter_map(|l| l.split_once('='))
        .collect();

    let get = |k: &str| map.get(k).and_then(|v| v.parse::<f64>().ok());

    Some(NvmlReading {
        temp_c: get("temp_c"),
        gpu_util_pct: get("gpu_util_pct"),
        vram_used_mb: get("vram_used_mb"),
        vram_total_mb: get("vram_total_mb"),
        power_w: get("power_w"),
    })
}
