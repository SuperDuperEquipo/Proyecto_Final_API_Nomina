import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNovedadDto } from './create-novedad.dto';
import { TipoNovedad } from '../enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from '../enums/subtipo-hora-extra.enum';

// monto/horas/subtipoHoraExtra no deben poder enviarse para un tipo que no los requiere.
describe('CreateNovedadDto - validación condicional por tipo', () => {
  const base = {
    empleadoId: 1,
    nominaId: 1,
    fecha: '2026-07-15',
  };

  it('rechaza monto cuando el tipo es HORAS_EXTRA', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.HORAS_EXTRA,
      horas: 5,
      subtipoHoraExtra: SubtipoHoraExtra.DIURNA,
      monto: 50, // no debería aplicar a HORAS_EXTRA
    });

    const errors = await validate(dto);
    const montoError = errors.find((e) => e.property === 'monto');
    expect(montoError).toBeDefined();
  });

  it('rechaza horas y subtipoHoraExtra cuando el tipo es BONIFICACION', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.BONIFICACION,
      monto: 100,
      horas: 3, // no debería aplicar a BONIFICACION
      subtipoHoraExtra: SubtipoHoraExtra.NOCTURNA, // tampoco
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'horas')).toBeDefined();
    expect(errors.find((e) => e.property === 'subtipoHoraExtra')).toBeDefined();
  });

  it('exige horas y subtipoHoraExtra cuando el tipo es HORAS_EXTRA', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.HORAS_EXTRA,
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'horas')).toBeDefined();
    expect(errors.find((e) => e.property === 'subtipoHoraExtra')).toBeDefined();
  });

  it('exige monto cuando el tipo es DESCUENTO', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.DESCUENTO,
    });

    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'monto')).toBeDefined();
  });

  it('acepta una novedad HORAS_EXTRA válida y completa', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.HORAS_EXTRA,
      horas: 5,
      subtipoHoraExtra: SubtipoHoraExtra.DIURNA,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('acepta una novedad BONIFICACION válida y completa', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.BONIFICACION,
      monto: 75,
      afectaBasePrestaciones: true,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('acepta una novedad PERMISO_SIN_GOCE sin horas ni monto', async () => {
    const dto = plainToInstance(CreateNovedadDto, {
      ...base,
      tipo: TipoNovedad.PERMISO_SIN_GOCE,
      descripcion: 'Permiso por asuntos personales',
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
