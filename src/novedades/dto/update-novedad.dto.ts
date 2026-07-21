import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateNovedadDto } from './create-novedad.dto';

export class UpdateNovedadDto extends PartialType(
  OmitType(CreateNovedadDto, ['empleadoId', 'nominaId'] as const),
) {}
