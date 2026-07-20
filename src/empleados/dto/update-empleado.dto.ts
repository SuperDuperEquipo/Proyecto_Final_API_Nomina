import { PartialType, ApiProperty } from '@nestjs/swagger';
import { CreateEmpleadoDto } from './create-empleado.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdateEmpleadoDto extends PartialType(CreateEmpleadoDto) {
  @ApiProperty({ example: 'Incremento anual de desempeño', required: false })
  @IsOptional()
  @IsString()
  motivoCambioSalario?: string;
}
