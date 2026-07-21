import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { EmpleadoRole } from '../entities/empleado.entity';
import { TipoDocumento } from '../entities/tipo-documento.enum';
import { SectorEconomico } from '../entities/sector-economico.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmpleadoDto {
  @ApiProperty({ example: 'Susana Beltrán' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({
    enum: TipoDocumento,
    example: TipoDocumento.DUI,
    default: TipoDocumento.DUI,
  })
  @IsNotEmpty()
  @IsEnum(TipoDocumento)
  tipoDocumento: TipoDocumento;

  @ApiProperty({ example: '01234567-8' })
  @IsNotEmpty()
  @IsString()
  documentoIdentidad: string;

  @ApiProperty({ example: 'susana@nomina.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsOptional()
  @IsString()
  password?: string;

  @ApiProperty({
    enum: SectorEconomico,
    example: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
    required: false,
    default: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
  })
  @IsOptional()
  @IsEnum(SectorEconomico)
  sectorEconomico?: SectorEconomico;

  @ApiProperty({ example: 1200.0 })
  @IsNotEmpty()
  @IsNumber()
  @IsPositive()
  salarioBase: number;

  @ApiProperty({ example: 'Desarrollador Backend' })
  @IsNotEmpty()
  @IsString()
  cargo: string;

  @ApiProperty({ example: 'Tecnología' })
  @IsNotEmpty()
  @IsString()
  area: string;

  @ApiProperty({ example: '2026-07-15' })
  @IsNotEmpty()
  @IsDateString()
  fechaIngreso: string;

  @ApiProperty({ example: 'AFP Crecer', required: false })
  @IsOptional()
  @IsString()
  afp?: string;

  @ApiProperty({ example: '123456789', required: false })
  @IsOptional()
  @IsString()
  isss?: string;

  @ApiProperty({
    enum: EmpleadoRole,
    example: EmpleadoRole.EMPLEADO,
    required: false,
  })
  @IsOptional()
  @IsEnum(EmpleadoRole)
  rol?: EmpleadoRole;
}
