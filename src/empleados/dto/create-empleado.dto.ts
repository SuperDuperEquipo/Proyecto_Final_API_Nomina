import { IsNotEmpty, IsString, IsNumber, IsPositive, IsDateString, IsEmail, IsEnum, IsOptional, Length } from 'class-validator';
import { EmpleadoRole } from '../entities/empleado.entity';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmpleadoDto {
  @ApiProperty({ example: 'Susana Beltrán' })
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @ApiProperty({ example: '01234567-8' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 10, { message: 'El DUI debe tener exactamente 10 caracteres (ej. 00000000-0)' })
  dui: string;

  @ApiProperty({ example: 'susana@nomina.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', required: false })
  @IsOptional()
  @IsString()
  @Length(6, 50, { message: 'La contraseña debe tener entre 6 y 50 caracteres' })
  password?: string;

  @ApiProperty({ example: 1200.00 })
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

  @ApiProperty({ example: 'AFP Crecer' })
  @IsNotEmpty()
  @IsString()
  afp: string;

  @ApiProperty({ enum: EmpleadoRole, example: EmpleadoRole.EMPLEADO, required: false })
  @IsOptional()
  @IsEnum(EmpleadoRole)
  rol?: EmpleadoRole;
}
