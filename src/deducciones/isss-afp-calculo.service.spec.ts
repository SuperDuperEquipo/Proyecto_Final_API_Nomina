import { IsssAfpCalculoService } from './isss-afp-calculo.service';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';

describe('IsssAfpCalculoService', () => {
  let service: IsssAfpCalculoService;

  const configSinTopeAfp = {
    issssPctTrabajador: 3,
    issssPctPatronal: 7.5,
    issssTopeBase: 1000,
    afpPctTrabajador: 7.25,
    afpPctPatronal: 8.75,
    afpTopeBase: null,
  } as ConfiguracionDeduccion;

  beforeEach(() => {
    service = new IsssAfpCalculoService();
  });

  it('salario bajo el tope de ISSS: ambas deducciones se calculan sobre el monto real', () => {
    const resultado = service.calcular(850, 850, configSinTopeAfp);
    expect(resultado).toEqual({
      issssTrabajador: 25.5,
      issssPatronal: 63.75,
      afpTrabajador: 61.63,
      afpPatronal: 74.38,
    });
  });

  it('salario sobre el tope de ISSS ($1,000): ISSS se topa, AFP no (sin tope configurado)', () => {
    const resultado = service.calcular(2500, 2500, configSinTopeAfp);
    expect(resultado).toEqual({
      issssTrabajador: 30,
      issssPatronal: 75,
      afpTrabajador: 181.25,
      afpPatronal: 218.75,
    });
  });

  it('si se configura un tope de AFP, también se aplica (caso hipotético, hoy afpTopeBase es null)', () => {
    const configConTopeAfp = { ...configSinTopeAfp, afpTopeBase: 1500 };
    const resultado = service.calcular(2500, 2500, configConTopeAfp);
    expect(resultado.afpTrabajador).toBe(108.75);
    expect(resultado.afpPatronal).toBe(131.25);
  });

  it('bases distintas para ISSS y AFP se calculan de forma independiente (caso horas extra)', () => {
    const resultado = service.calcular(850, 950, configSinTopeAfp);
    expect(resultado.issssTrabajador).toBe(25.5);
    expect(resultado.afpTrabajador).toBe(68.88);
  });
});
