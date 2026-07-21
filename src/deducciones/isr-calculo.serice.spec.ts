import { IsrCalculoService } from './isr-calculo.service';
import { TramoISR } from './entities/tramo-isr.entity';

describe('IsrCalculoService', () => {
  let service: IsrCalculoService;

  const tramos: TramoISR[] = [
    { numeroTramo: 1, limiteInferior: 0.01, limiteSuperior: 550.0, porcentaje: 0, cuotaFija: 0 } as TramoISR,
    { numeroTramo: 2, limiteInferior: 550.01, limiteSuperior: 895.24, porcentaje: 10, cuotaFija: 17.67 } as TramoISR,
    { numeroTramo: 3, limiteInferior: 895.25, limiteSuperior: 2038.1, porcentaje: 20, cuotaFija: 60.0 } as TramoISR,
    { numeroTramo: 4, limiteInferior: 2038.11, limiteSuperior: null, porcentaje: 30, cuotaFija: 288.57 } as TramoISR,
  ];

  beforeEach(() => {
    service = new IsrCalculoService();
  });

  it('base gravable dentro del tramo exento: ISR = 0', () => {
    expect(service.calcular(300, tramos)).toBe(0);
    expect(service.calcular(550, tramos)).toBe(0);
  });

  it('justo al entrar al tramo II: el excedente se calcula contra $550, no $550.01', () => {
    expect(service.calcular(550.01, tramos)).toBe(17.67);
  });

  it('dentro del tramo II', () => {
    expect(service.calcular(700, tramos)).toBe(32.67);
  });

  it('en el límite superior del tramo II', () => {
    expect(service.calcular(895.24, tramos)).toBe(52.19);
  });

  it('justo al entrar al tramo III', () => {
    expect(service.calcular(895.25, tramos)).toBe(60);
  });

  it('caso completo verificado contra una fuente externa: salario $2,500/mes', () => {
    expect(service.calcular(2288.75, tramos)).toBe(363.77);
  });

  it('tramo IV, sin límite superior', () => {
    expect(service.calcular(5000, tramos)).toBe(1177.14);
  });

  it('base gravable cero o negativa: ISR = 0 sin consultar tramos', () => {
    expect(service.calcular(0, tramos)).toBe(0);
    expect(service.calcular(-50, tramos)).toBe(0);
  });

  it('lanza error si no hay tramo que cubra la base gravable (huecos en la configuración)', () => {
    const tramosIncompletos = [tramos[0], tramos[3]];
    expect(() => service.calcular(700, tramosIncompletos)).toThrow();
  });
});
