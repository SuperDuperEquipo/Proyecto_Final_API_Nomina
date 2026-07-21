// Redondeo comercial (round half up) a 2 decimales
export function redondearComercial(valor: number, decimales = 2): number {
  const factor = Math.pow(10, decimales);
  const valorLimpio = Number(valor.toPrecision(12));
  return Math.round((valorLimpio + Number.EPSILON) * factor) / factor;
}
