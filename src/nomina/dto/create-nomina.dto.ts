import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoNomina } from '../enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../enums/subtipo-nomina-especial.enum';

// Valida que subtipoEspecial sea obligatorio cuando tipo = ESPECIAL,
// y que se rechace (debe ir vacío) para cualquier otro tipo
function RequeridoSoloParaTipos(
  tiposQueAplican: TipoNomina[],
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
          const dto = args.object as CreateNominaDto;
          const aplica =
            dto.tipo !== undefined && tiposQueAplican.includes(dto.tipo);
          if (aplica) {
            return value !== undefined && value !== null && isValidValue(value);
          }
          return value === undefined || value === null;
        },
        defaultMessage(args: ValidationArguments) {
          const dto = args.object as CreateNominaDto;
          const aplica =
            dto.tipo !== undefined && tiposQueAplican.includes(dto.tipo);
          const tiposTexto = tiposQueAplican.join(' o ');
          return aplica
            ? `${propertyName} es obligatorio y debe ser válido cuando el tipo es ${tiposTexto}`
            : `${propertyName} solo aplica cuando el tipo es ${tiposTexto}, no debe enviarse para tipo ${String(dto.tipo)}`;
        },
      },
    });
  };
}

export class CreateNominaDto {
  @ApiProperty({
    example: '2026-07-Q2',
    description:
      'Período en formato AAAA-MM-Q1 o AAAA-MM-Q2 (primera o segunda quincena del mes).',
  })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-Q[12]$/, {
    message:
      'periodo debe tener el formato AAAA-MM-Q1 o AAAA-MM-Q2, ej. 2026-07-Q2',
  })
  periodo: string;

  @ApiProperty({
    enum: TipoNomina,
    example: TipoNomina.REGULAR,
    required: false,
    default: TipoNomina.REGULAR,
    description:
      'REGULAR si se omite. ESPECIAL corre en su propio ciclo (Quincena 25, Aguinaldo).',
  })
  @IsOptional()
  @IsEnum(TipoNomina)
  tipo?: TipoNomina;

  @ApiProperty({
    enum: SubtipoNominaEspecial,
    required: false,
    description:
      'Obligatorio únicamente cuando tipo = ESPECIAL; se rechaza si se envía para tipo REGULAR.',
  })
  @RequeridoSoloParaTipos([TipoNomina.ESPECIAL], (v) =>
    Object.values(SubtipoNominaEspecial).includes(v as SubtipoNominaEspecial),
  )
  subtipoEspecial?: SubtipoNominaEspecial;
}
