import {
  IsNotEmpty,
  IsInt,
  IsPositive,
  IsEnum,
  IsDateString,
  IsOptional,
  IsString,
  IsBoolean,
  MaxLength,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoNovedad } from '../enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from '../enums/subtipo-hora-extra.enum';

// Valida que un campo sea obligatorio  cuando dto.tipo está dentro de tiposQueAplican.
function RequeridoSoloParaTipos(
  tiposQueAplican: TipoNovedad[],
  isValidValue: (value: unknown) => boolean,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requeridoSoloParaTipos',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const dto = args.object as CreateNovedadDto;
          const aplica = tiposQueAplican.includes(dto.tipo);
          if (aplica) {
            return value !== undefined && value !== null && isValidValue(value);
          }
          return value === undefined || value === null;
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as CreateNovedadDto;
          const aplica = tiposQueAplican.includes(dto.tipo);
          const tiposTexto = tiposQueAplican.join(' o ');
          return aplica
            ? `${propertyName} es obligatorio y debe ser válido cuando el tipo es ${tiposTexto}`
            : `${propertyName} solo aplica cuando el tipo es ${tiposTexto}, no debe enviarse para tipo ${String((args.object as CreateNovedadDto).tipo)}`;
        },
      },
    });
  };
}

export class CreateNovedadDto {
  @ApiProperty({ example: 1, description: 'ID del empleado al que aplica la novedad' })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  empleadoId: number;

  @ApiProperty({ example: 1, description: 'ID de la nómina en el período a la que se registra la novedad.' })
  @IsNotEmpty()
  @IsInt()
  @IsPositive()
  nominaId: number;

  @ApiProperty({ enum: TipoNovedad, example: TipoNovedad.HORAS_EXTRA })
  @IsNotEmpty()
  @IsEnum(TipoNovedad)
  tipo: TipoNovedad;

  @ApiProperty({
    example: 5,
    required: false,
    description: 'Cantidad de horas. Obligatorio únicamente cuando tipo = HORAS_EXTRA; se rechaza si se envía para cualquier otro tipo.',
  })
  @RequeridoSoloParaTipos(
    [TipoNovedad.HORAS_EXTRA],
    (v) => typeof v === 'number' && v > 0,
  )
  horas?: number;

  @ApiProperty({
    enum: SubtipoHoraExtra,
    example: SubtipoHoraExtra.DIURNA,
    required: false,
    description: 'Obligatorio únicamente cuando tipo = HORAS_EXTRA; se rechaza si se envía para cualquier otro tipo. El recargo legal difiere entre horas diurnas, nocturnas y las trabajadas en día de descanso/asueto.',
  })
  @RequeridoSoloParaTipos(
    [TipoNovedad.HORAS_EXTRA],
    (v) => Object.values(SubtipoHoraExtra).includes(v as SubtipoHoraExtra),
  )
  subtipoHoraExtra?: SubtipoHoraExtra;

  @ApiProperty({
    example: 50,
    required: false,
    description: 'Monto en dólares. Obligatorio únicamente cuando tipo = BONIFICACION o DESCUENTO; se rechaza si se envía para cualquier otro tipo.',
  })
  @RequeridoSoloParaTipos(
    [TipoNovedad.BONIFICACION, TipoNovedad.DESCUENTO],
    (v) => typeof v === 'number' && v > 0,
  )
  monto?: number;

  @ApiProperty({
    example: '2026-07-15',
    description: 'Fecha de devengo de la novedad, no la fecha de registro. Para comisiones registradas como bonificación, debe ser la fecha en que el cliente pagó.',
  })
  @IsNotEmpty()
  @IsDateString()
  fecha: string;

  @ApiProperty({ example: 'Horas extra por cierre de mes', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description:
      'Solo aplica a bonificación, true si es habitual o recurrente. False si es una liberalidad ocasional del patrono.'
  })
  @IsOptional()
  @IsBoolean()
  afectaBasePrestaciones?: boolean;
}
