import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TipoNomina } from '../enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../enums/subtipo-nomina-especial.enum';
import { MotivoVacaciones } from '../enums/motivo-vacaciones.enum';

export class CreateNominaDto {
  @ApiProperty({
    example: '2026-12-Q2',
    description: 'Período en formato AAAA-MM-Q1 o AAAA-MM-Q2.',
  })
  @IsNotEmpty()
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
    example: SubtipoNominaEspecial.AGUINALDO,
    required: false,
    description: 'Obligatorio cuando tipo es ESPECIAL.',
  })
  @IsOptional()
  @IsEnum(SubtipoNominaEspecial)
  subtipoEspecial?: SubtipoNominaEspecial;

  @ApiProperty({
    enum: MotivoVacaciones,
    example: MotivoVacaciones.PERIODO_NORMAL,
    required: false,
    description: 'Solo aplica a nóminas especiales de vacaciones.',
  })
  @IsOptional()
  @IsEnum(MotivoVacaciones)
  motivoVacaciones?: MotivoVacaciones;
}