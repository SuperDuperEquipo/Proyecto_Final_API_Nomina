import { redondearComercial } from './redondeo.util';

describe('redondearComercial', () => {
  it('redondea hacia arriba en el punto medio exacto', () => {
    expect(redondearComercial(1.005)).toBe(1.01);
    expect(redondearComercial(0.125, 2)).toBe(0.13);
  });

  it('no altera valores que ya tienen 2 decimales', () => {
    expect(redondearComercial(30.0)).toBe(30);
    expect(redondearComercial(17.67)).toBe(17.67);
  });

  it('redondea hacia abajo cuando corresponde', () => {
    expect(redondearComercial(10.494)).toBe(10.49);
  });

  it('el caso que falla con toFixed() nativo se resuelve correctamente', () => {
    expect(Number((1.005).toFixed(2))).toBe(1.0);
    expect(redondearComercial(1.005)).toBe(1.01);
  });

  it('corrige el error de precisión de una división previa (7.25/100), no solo de literales', () => {
    const valor = 850 * (7.25 / 100);
    expect(redondearComercial(valor)).toBe(61.63);
  });
});
