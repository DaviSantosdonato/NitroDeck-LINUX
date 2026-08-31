//! Confirma o modelo exato do notebook antes de permitir qualquer escrita
//! via WMI (ventoinha, bateria, extras). Nunca reescreva isso para "aceitar
//! qualquer modelo" sem validar de novo em hardware real — os métodos WMI
//! variam por modelo e nunca foram testados fora do Nitro ANV15-52.

use std::fs;

pub const CONFIRMED_MODEL: &str = "Nitro ANV15-52";

pub fn is_confirmed() -> bool {
    fs::read_to_string("/sys/class/dmi/id/product_name")
        .map(|s| s.trim() == CONFIRMED_MODEL)
        .unwrap_or(false)
}
