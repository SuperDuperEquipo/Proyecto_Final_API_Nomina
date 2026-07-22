import { SimulacionDeduccionesService } from './simulacion-deducciones.service';
import { ClasificacionDeduccionesService } from './clasificacion-deducciones.service';
import { IsssAfpCalculoService } from './isss-afp-calculo.service';
import { IsrCalculoService } from './isr-calculo.service';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';

describe('SimulacionDeduccionesService', () => {
  let service: SimulacionDeduccionesService;
  let configVigenteMock: any;

  const config = {
    issssPctTrabajador: 3,
    issssPctPatronal: 7.5,
    issssTopeBase: 1000,
    afpPctTrabajador: 7.25,
    afpPctPatronal: 8.75,
    afpTopeBase: null,
  } as ConfiguracionDeduccion;

  const tramos: TramoISR[] = [
    { numeroTramo: 1, limiteInferior: 0.01, limiteSuperior: 550.0, porcentaje: 0, cuotaFija: 0 } as TramoISR,
    { numeroTramo: 2, limiteInferior: 550.01, limiteSuperior: 895.24, porcentaje: 10, cuotaFija: 17.67 } as TramoISR,
    { numeroTramo: 3, limiteInferior: 895.25, limiteSuperior: 2038.1, porcentaje: 20, cuotaFija: 60.0 } as TramoISR,
    { numeroTramo: 4, limiteInferior: 2038.11, limiteSuperior: null, porcentaje: 30, cuotaFija: 288.57 } as TramoISR,
  ];

  beforeEach(() => {
    configVigenteMock = {
      obtenerConfiguracionVigente: jest.fn().mockResolvedValue(config),
      obtenerTramosIsrVigentes: jest.fn().mockResolvedValue(tramos),
    };

    service = new SimulacionDeduccionesService(
      new ClasificacionDeduccionesService(),
      configVigenteMock,
      new IsssAfpCalculoService(),
      new IsrCalculoService(),
    );
  });

  it('sin bonificación: salario $850 da neto $723.91', async () => {
    const resultado = await service.simular({ salarioBase: 850, fecha: '2026-07-22' });

    expect(resultado).toEqual({
      salarioBase: 850,
      bonificacion: null,
      baseISSS: 850,
      baseAFP: 850,
      issssTrabajador: 25.5,
      issssPatronal: 63.75,
      afpTrabajador: 61.63,
      afpPatronal: 74.38,
      baseGravableISR: 762.87,
      isr: 38.96,
      salarioNeto: 723.91,
    });
  });

  it('bonificación habitual de $100: cuenta en las 3 bases, neto $804.69', async () => {
    const resultado = await service.simular({
      salarioBase: 850,
      fecha: '2026-07-22',
      bonificacion: { monto: 100, habitual: true },
    });

    expect(resultado.baseISSS).toBe(950);
    expect(resultado.baseAFP).toBe(950);
    expect(resultado.salarioNeto).toBe(804.69);
  });

  it('bonificación ocasional de $100: NO cuenta ISSS/AFP pero sí ISR, neto $813.91 (mayor que la habitual)', async () => {
    const resultado = await service.simular({
      salarioBase: 850,
      fecha: '2026-07-22',
      bonificacion: { monto: 100, habitual: false },
    });

    expect(resultado.baseISSS).toBe(850);
    expect(resultado.baseAFP).toBe(850);
    expect(resultado.issssTrabajador).toBe(25.5);
    expect(resultado.afpTrabajador).toBe(61.63);
    expect(resultado.baseGravableISR).toBe(862.87);
    expect(resultado.salarioNeto).toBe(813.91);
  });

  it('la bonificación ocasional deja más neto que la habitual con el mismo monto (por saltarse ISSS/AFP)', async () => {
    const conHabitual = await service.simular({
      salarioBase: 850,
      fecha: '2026-07-22',
      bonificacion: { monto: 100, habitual: true },
    });
    const conOcasional = await service.simular({
      salarioBase: 850,
      fecha: '2026-07-22',
      bonificacion: { monto: 100, habitual: false },
    });

    expect(conOcasional.salarioNeto).toBeGreaterThan(conHabitual.salarioNeto);
  });

  it('propaga el error 422 si falta configuración para la fecha', async () => {
    configVigenteMock.obtenerConfiguracionVigente.mockRejectedValue(new Error('sin config'));

    await expect(service.simular({ salarioBase: 850, fecha: '2020-01-01' })).rejects.toThrow();
  });
});
