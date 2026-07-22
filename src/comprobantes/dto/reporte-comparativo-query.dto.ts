import { IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReporteComparativoQueryDto {
  @ApiProperty({ example: '2026-07-Q2' })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-Q[12]$/, {
    message: 'periodoActual debe tener el formato AAAA-MM-Q1 o AAAA-MM-Q2',
  })
  periodoActual!: string;

  @ApiProperty({ example: '2026-07-Q1' })
  @IsNotEmpty()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-Q[12]$/, {
    message: 'periodoAnterior debe tener el formato AAAA-MM-Q1 o AAAA-MM-Q2',
  })
  periodoAnterior!: string;
}