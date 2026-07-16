import { IsNotEmpty, IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@nomina.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'adminPassword123' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 50)
  password: string;
}
