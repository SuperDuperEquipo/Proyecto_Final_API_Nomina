import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmpleadosService } from './empleados.service';
import { EmpleadosController } from './empleados.controller';
import { Empleado } from './entities/empleado.entity';
import { HistorialSalario } from './entities/historial-salario.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Empleado, HistorialSalario])],
  controllers: [EmpleadosController],
  providers: [EmpleadosService],
  exports: [EmpleadosService, TypeOrmModule],
})
export class EmpleadosModule {}
