# Origem deste driver

O código em `linuwu_sense.c` é um **fork** do projeto
[Linuwu-Sense](https://github.com/0x7375646F/Linuwu-Sense), de **0x7375646F**,
licenciado sob **GPL-3.0** (veja `LICENSE` neste diretório — texto integral e
inalterado, como a licença exige).

- Repositório original: https://github.com/0x7375646F/Linuwu-Sense
- Commit de origem: `73a25ec243a44ba2b1703e8d0a76fa2735062506` (2026-03-13)
- Trazido para este repositório em: 2026-08-31

Esse driver existe por causa de um trabalho real de engenharia reversa dos
métodos WMI/ACPI que a Acer usa nos notebooks Nitro/Predator — descoberto e
mantido pelo autor original, não por nós. Nós não reimplementamos essa
comunicação do zero; empacotamos e mantemos uma cópia dela junto do
NitroDeck para instalação automática, e podemos propor mudanças aqui, mas o
crédito da engenharia reversa é do projeto original.

Se você alterar este arquivo, documente a mudança — isso ajuda a manter
rastreável o que é "nosso empacotamento" e o que é "lógica original do
driver", especialmente porque é código que fala diretamente com o firmware
da placa-mãe.
