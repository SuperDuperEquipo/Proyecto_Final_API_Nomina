import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateNominaDto } from './create-nomina.dto';
import { TipoNomina } from '../enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../enums/subtipo-nomina-especial.enum';

describe('CreateNominaDto - validación condicional por tipo', () => {
  it('rechaza un periodo con formato inválido', async () => {
    const dto = plainToInstance(CreateNominaDto, { periodo: '2026-07' });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
  });

  it('acepta un periodo con formato válido y tipo REGULAR implícito', async () => {
    const dto = plainToInstance(CreateNominaDto, { periodo: '2026-07-Q2' });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('exige subtipoEspecial cuando tipo = ESPECIAL', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-01-Q1',
      tipo: TipoNomina.ESPECIAL,
    });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'subtipoEspecial')).toBeDefined();
  });

  it('rechaza subtipoEspecial cuando tipo = REGULAR', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-07-Q2',
      tipo: TipoNomina.REGULAR,
      subtipoEspecial: SubtipoNominaEspecial.AGUINALDO,
    });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'subtipoEspecial')).toBeDefined();
  });

  it('acepta una nomina ESPECIAL con subtipoEspecial válido', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-01-Q1',
      tipo: TipoNomina.ESPECIAL,
      subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
