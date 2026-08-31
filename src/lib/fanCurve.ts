// Curva de ventoinha por temperatura — estimativa nossa (não uma tabela
// oficial da Acer/fabricante), documentada aqui por não termos uma fonte
// melhor. Usada tanto no texto de sugestão (Visão Geral) quanto no modo de
// curva automática de verdade (Ventoinhas).
export function suggestedFanPercent(maxTempC: number): number {
  if (maxTempC < 55) return 0;
  if (maxTempC < 65) return 30;
  if (maxTempC < 75) return 50;
  if (maxTempC < 85) return 70;
  return 100;
}
