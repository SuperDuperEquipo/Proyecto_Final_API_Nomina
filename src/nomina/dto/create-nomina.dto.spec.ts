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
      periodo: '2026-01-20',
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
      periodo: '2026-01-20',
      tipo: TipoNomina.ESPECIAL,
      subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rechaza un periodo quincenal (formato REGULAR) para tipo ESPECIAL', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-01-Q1',
      tipo: TipoNomina.ESPECIAL,
      subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
    });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
  });

  it('rechaza una fecha de pago (formato ESPECIAL) para tipo REGULAR', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-01-20',
      tipo: TipoNomina.REGULAR,
    });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
  });

  it('rechaza una fecha de pago calendario inválida para tipo ESPECIAL (ej. 30 de febrero)', async () => {
    const dto = plainToInstance(CreateNominaDto, {
      periodo: '2026-02-30',
      tipo: TipoNomina.ESPECIAL,
      subtipoEspecial: SubtipoNominaEspecial.AGUINALDO,
    });

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
  });

  describe('ventana legal de pago según subtipoEspecial', () => {
    it.each(['2026-01-15', '2026-01-20', '2026-01-25'])(
      'acepta Quincena 25 en %s (dentro del 15-25 de enero)',
      async (periodo) => {
        const dto = plainToInstance(CreateNominaDto, {
          periodo,
          tipo: TipoNomina.ESPECIAL,
          subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
        });

        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'periodo')).toBeUndefined();
      },
    );

    it.each(['2026-01-14', '2026-01-26', '2026-02-01'])(
      'rechaza Quincena 25 en %s (fuera del 15-25 de enero)',
      async (periodo) => {
        const dto = plainToInstance(CreateNominaDto, {
          periodo,
          tipo: TipoNomina.ESPECIAL,
          subtipoEspecial: SubtipoNominaEspecial.QUINCENA_25,
        });

        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
      },
    );

    it.each(['2026-10-20', '2026-11-15', '2026-12-20'])(
      'acepta Aguinaldo en %s (dentro del 20 oct-20 dic)',
      async (periodo) => {
        const dto = plainToInstance(CreateNominaDto, {
          periodo,
          tipo: TipoNomina.ESPECIAL,
          subtipoEspecial: SubtipoNominaEspecial.AGUINALDO,
        });

        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'periodo')).toBeUndefined();
      },
    );

    it.each(['2026-10-19', '2026-12-21', '2026-09-01'])(
      'rechaza Aguinaldo en %s (fuera del 20 oct-20 dic)',
      async (periodo) => {
        const dto = plainToInstance(CreateNominaDto, {
          periodo,
          tipo: TipoNomina.ESPECIAL,
          subtipoEspecial: SubtipoNominaEspecial.AGUINALDO,
        });

        const errors = await validate(dto);

        expect(errors.find((e) => e.property === 'periodo')).toBeDefined();
      },
    );
  });
});
