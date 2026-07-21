import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpdateNovedadDto } from './update-novedad.dto';
import { TipoNovedad } from '../enums/tipo-novedad.enum';

describe('UpdateNovedadDto - validación condicional en PATCH', () => {
  it('permite omitir campos no enviados (PATCH parcial)', async () => {
    const dto = plainToInstance(UpdateNovedadDto, { descripcion: 'ajuste de texto' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza monto si se envía sin un tipo que lo requiera en el mismo PATCH', async () => {
    const dto = plainToInstance(UpdateNovedadDto, { monto: 75 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'monto')).toBeDefined();
  });

  it('acepta monto cuando se envía junto con tipo BONIFICACION en el mismo PATCH', async () => {
    const dto = plainToInstance(UpdateNovedadDto, { tipo: TipoNovedad.BONIFICACION, monto: 75 });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza monto cuando se envía junto con tipo HORAS_EXTRA en el mismo PATCH', async () => {
    const dto = plainToInstance(UpdateNovedadDto, { tipo: TipoNovedad.HORAS_EXTRA, monto: 75 });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'monto')).toBeDefined();
  });
});
