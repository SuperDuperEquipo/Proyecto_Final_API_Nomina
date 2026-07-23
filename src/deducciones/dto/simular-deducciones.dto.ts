import {
  IsNotEmpty,
  IsDateString,
  IsNumber,
  Min,
  IsOptional,
  ValidateNested,
  IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BonificacionSimulacionDto {
  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  monto: number;

  @ApiProperty({ example: true, description: 'true = habitual/recurrente, false = liberalidad ocasional (Art. 119 CT)' })
  @IsBoolean()
  habitual: boolean;
}

export class SimularDeduccionesDto {
  @ApiProperty({ example: 850 })
  @IsNumber()
  @Min(0)
  salarioBase: number;

  @ApiProperty({ example: '2026-07-22', description: 'Fecha para buscar la configuración/tramos vigentes' })
  @IsNotEmpty()
  @IsDateString()
  fecha: string;

  @ApiProperty({ type: BonificacionSimulacionDto, required: false })

  @ValidateNested()
  @Type(() => BonificacionSimulacionDto)
  bonificacion?: BonificacionSimulacionDto;
}
