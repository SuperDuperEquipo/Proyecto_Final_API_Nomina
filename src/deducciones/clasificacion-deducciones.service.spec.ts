import { ClasificacionDeduccionesService } from './clasificacion-deducciones.service';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';

describe('ClasificacionDeduccionesService', () => {
  let service: ClasificacionDeduccionesService;

  beforeEach(() => {
    service = new ClasificacionDeduccionesService();
  });

  it('HORAS_EXTRA: no cuenta ISSS, sí cuenta AFP e ISR', () => {
    expect(service.clasificar(TipoNovedad.HORAS_EXTRA, null)).toEqual({
      cuentaISSS: false,
      cuentaAFP: true,
      cuentaISR: true,
    });
  });

  it('BONIFICACION habitual (afectaBasePrestaciones=true): cuenta en los tres', () => {
    expect(service.clasificar(TipoNovedad.BONIFICACION, true)).toEqual({
      cuentaISSS: true,
      cuentaAFP: true,
      cuentaISR: true,
    });
  });

  it('BONIFICACION ocasional (afectaBasePrestaciones=false): no cuenta ISSS ni AFP, sí ISR', () => {
    expect(service.clasificar(TipoNovedad.BONIFICACION, false)).toEqual({
      cuentaISSS: false,
      cuentaAFP: false,
      cuentaISR: true,
    });
  });

  it('LICENCIA_MATERNIDAD: cuenta en los tres, con tope individual de $1,000 para AFP', () => {
    expect(service.clasificar(TipoNovedad.LICENCIA_MATERNIDAD, null)).toEqual({
      cuentaISSS: true,
      cuentaAFP: true,
      cuentaISR: true,
      topeIndividualAFP: 1000,
    });
  });

  it('HORAS_EXTRA y BONIFICACION no llevan tope individual de AFP', () => {
    expect(
      service.clasificar(TipoNovedad.HORAS_EXTRA, null).topeIndividualAFP,
    ).toBeUndefined();
    expect(
      service.clasificar(TipoNovedad.BONIFICACION, true).topeIndividualAFP,
    ).toBeUndefined();
  });

  it('PERMISO_SIN_GOCE: lanza error porque no se maneja con esta clasificación', () => {
    expect(() =>
      service.clasificar(TipoNovedad.PERMISO_SIN_GOCE, null),
    ).toThrow();
  });

  it('DESCUENTO: lanza error porque no se maneja con esta clasificación', () => {
    expect(() => service.clasificar(TipoNovedad.DESCUENTO, null)).toThrow();
  });
});
