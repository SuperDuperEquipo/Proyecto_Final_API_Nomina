import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoNomina } from '../enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../enums/subtipo-nomina-especial.enum';
import { MotivoVacaciones } from '../enums/motivo-vacaciones.enum';

function esFechaCalendarioValida(
  anio: number,
  mes: number,
  dia: number,
): boolean {
  const fecha = new Date(anio, mes - 1, dia);

  return (
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

function fechaEnVentana(
  fecha: Date,
  mesInicio: number,
  diaInicio: number,
  mesFin: number,
  diaFin: number,
): boolean {
  const anio = fecha.getFullYear();

  const inicio = new Date(
    anio,
    mesInicio - 1,
    diaInicio,
  );

  const fin = new Date(
    anio,
    mesFin - 1,
    diaFin,
  );

  return fecha >= inicio && fecha <= fin;
}

// REGULAR utiliza períodos quincenales AAAA-MM-Q1/Q2.
// ESPECIAL utiliza una fecha exacta de pago AAAA-MM-DD.
//
// QUINCENA_25 tiene una ventana del 15 al 25 de enero.
// AGUINALDO tiene una ventana del 20 de octubre al 20 de diciembre.
// VACACIONES puede procesarse en cualquier fecha calendario válida.
function FormatoPeriodoSegunTipo(
  validationOptions?: ValidationOptions,
) {
  return function (
    object: object,
    propertyName: string,
  ) {
    registerDecorator({
      name: 'formatoPeriodoSegunTipo',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(
          value: unknown,
          args: ValidationArguments,
        ) {
          if (typeof value !== 'string') {
            return false;
          }

          const dto =
            args.object as CreateNominaDto;

          if (
            dto.tipo ===
            TipoNomina.ESPECIAL
          ) {
            const match =
              /^(\d{4})-(\d{2})-(\d{2})$/.exec(
                value,
              );

            if (!match) {
              return false;
            }

            const anio = Number(match[1]);
            const mes = Number(match[2]);
            const dia = Number(match[3]);

            if (
              !esFechaCalendarioValida(
                anio,
                mes,
                dia,
              )
            ) {
              return false;
            }

            const fecha = new Date(
              anio,
              mes - 1,
              dia,
            );

            if (
              dto.subtipoEspecial ===
              SubtipoNominaEspecial.QUINCENA_25
            ) {
              return fechaEnVentana(
                fecha,
                1,
                15,
                1,
                25,
              );
            }

            if (
              dto.subtipoEspecial ===
              SubtipoNominaEspecial.AGUINALDO
            ) {
              return fechaEnVentana(
                fecha,
                10,
                20,
                12,
                20,
              );
            }

            // VACACIONES solamente requiere
            // una fecha calendario válida.
            return true;
          }

          return /^\d{4}-(0[1-9]|1[0-2])-Q[12]$/.test(
            value,
          );
        },

        defaultMessage(
          args: ValidationArguments,
        ) {
          const dto =
            args.object as CreateNominaDto;

          if (
            dto.tipo ===
            TipoNomina.ESPECIAL
          ) {
            if (
              dto.subtipoEspecial ===
              SubtipoNominaEspecial.QUINCENA_25
            ) {
              return 'periodo debe ser una fecha de pago entre el 15 y el 25 de enero (AAAA-01-DD) para Quincena 25, ej. 2026-01-20';
            }

            if (
              dto.subtipoEspecial ===
              SubtipoNominaEspecial.AGUINALDO
            ) {
              return 'periodo debe ser una fecha de pago entre el 20 de octubre y el 20 de diciembre (AAAA-MM-DD) para Aguinaldo, ej. 2026-12-01';
            }

            return 'periodo debe ser una fecha de pago válida en formato AAAA-MM-DD cuando tipo = ESPECIAL, ej. 2026-09-20';
          }

          return 'periodo debe tener el formato AAAA-MM-Q1 o AAAA-MM-Q2, ej. 2026-07-Q2';
        },
      },
    });
  };
}

function RequeridoSoloParaTipos(
  tiposQueAplican: TipoNomina[],
  isValidValue: (
    value: unknown,
  ) => boolean,
  validationOptions?: ValidationOptions,
) {
  return function (
    object: object,
    propertyName: string,
  ) {
    registerDecorator({
      name: 'requeridoSoloParaTipos',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(
          value: unknown,
          args: ValidationArguments,
        ) {
          const dto =
            args.object as CreateNominaDto;

          const aplica =
            dto.tipo !== undefined &&
            tiposQueAplican.includes(
              dto.tipo,
            );

          if (aplica) {
            return (
              value !== undefined &&
              value !== null &&
              isValidValue(value)
            );
          }

          return (
            value === undefined ||
            value === null
          );
        },

        defaultMessage(
          args: ValidationArguments,
        ) {
          const dto =
            args.object as CreateNominaDto;

          const aplica =
            dto.tipo !== undefined &&
            tiposQueAplican.includes(
              dto.tipo,
            );

          const tiposTexto =
            tiposQueAplican.join(' o ');

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
      'REGULAR: período quincenal AAAA-MM-Q1/Q2. ESPECIAL: fecha de pago AAAA-MM-DD.',
  })
  @IsNotEmpty()
  @FormatoPeriodoSegunTipo()
  periodo!: string;

  @ApiProperty({
    enum: TipoNomina,
    example: TipoNomina.REGULAR,
    required: false,
    default: TipoNomina.REGULAR,
  })
  @IsOptional()
  @IsEnum(TipoNomina)
  tipo?: TipoNomina;

  @ApiProperty({
    enum: SubtipoNominaEspecial,
    example:
      SubtipoNominaEspecial.AGUINALDO,
    required: false,
    description:
      'Obligatorio cuando tipo es ESPECIAL.',
  })
  @RequeridoSoloParaTipos(
    [TipoNomina.ESPECIAL],
    (value) =>
      Object.values(
        SubtipoNominaEspecial,
      ).includes(
        value as SubtipoNominaEspecial,
      ),
  )
  subtipoEspecial?:
    SubtipoNominaEspecial;

  @ApiProperty({
    enum: MotivoVacaciones,
    example:
      MotivoVacaciones.PERIODO_NORMAL,
    required: false,
    description:
      'Solo aplica a nóminas especiales de vacaciones.',
  })
  @IsOptional()
  @IsEnum(MotivoVacaciones)
  motivoVacaciones?: MotivoVacaciones;
}