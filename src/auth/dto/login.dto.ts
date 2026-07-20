import { IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: '00000000-0', description: 'Número de DUI, Pasaporte o Carnet de Residencia' })
  @IsNotEmpty()
  @IsString()
  documentoIdentidad: string;

  @ApiProperty({ example: 'adminPassword123' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 50)
  password: string;
}
