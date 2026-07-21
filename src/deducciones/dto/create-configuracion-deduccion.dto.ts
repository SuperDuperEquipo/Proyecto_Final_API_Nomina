import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConfiguracionDeduccionDto {
  @ApiProperty({
    example: '2025-05-08',
    description: 'Fecha desde la que aplica esta configuración.',
  })
  @IsNotEmpty()
  @IsDateString()
  vigenteDesde: string;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  issssPctTrabajador: number;

  @ApiProperty({ example: 7.5 })
  @IsNumber()
  @Min(0)
  @Max(100)
  issssPctPatronal: number;

  @ApiProperty({ example: 1000.0 })
  @IsNumber()
  @Min(0)
  issssTopeBase: number;

  @ApiProperty({ example: 7.25 })
  @IsNumber()
  @Min(0)
  @Max(100)
  afpPctTrabajador: number;

  @ApiProperty({ example: 8.75 })
  @IsNumber()
  @Min(0)
  @Max(100)
  afpPctPatronal: number;

  @ApiProperty({
    example: null,
    required: false,
    description:
      'Tope de cotización de AFP. null = sin tope (caso vigente hoy).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  afpTopeBase?: number | null;
}
