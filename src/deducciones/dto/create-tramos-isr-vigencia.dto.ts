import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class TramoIsrItemDto {
  @ApiProperty({
    example: 1,
    description: 'Orden del tramo: 1 (exento) a 4 (más alto).',
  })
  @IsInt()
  @Min(1)
  @Max(4)
  numeroTramo: number;

  @ApiProperty({ example: 0.01 })
  @IsNumber()
  @Min(0)
  limiteInferior: number;

  @ApiProperty({
    example: 550.0,
    required: false,
    description:
      'null solo permitido en el tramo más alto (sin límite superior).',
  })
  @IsOptional()
  @IsNumber()
  limiteSuperior?: number | null;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  porcentaje: number;

  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  cuotaFija: number;
}

export class CreateTramosIsrVigenciaDto {
  @ApiProperty({
    example: '2025-05-08',
    description: 'Fecha desde la que aplica esta tabla de ISR.',
  })
  @IsNotEmpty()
  @IsDateString()
  vigenteDesde: string;

  @ApiProperty({
    type: [TramoIsrItemDto],
    description: 'Exactamente 4 tramos, numerados 1 a 4.',
    example: [
      { numeroTramo: 1, limiteInferior: 0.01, limiteSuperior: 550.0, porcentaje: 0, cuotaFija: 0 },
      { numeroTramo: 2, limiteInferior: 550.01, limiteSuperior: 895.24, porcentaje: 10, cuotaFija: 17.67 },
      { numeroTramo: 3, limiteInferior: 895.25, limiteSuperior: 2038.1, porcentaje: 20, cuotaFija: 60.0 },
      { numeroTramo: 4, limiteInferior: 2038.11, limiteSuperior: null, porcentaje: 30, cuotaFija: 288.57 },
    ],
  })
  @ValidateNested({ each: true })
  @Type(() => TramoIsrItemDto)
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  tramos: TramoIsrItemDto[];
}
