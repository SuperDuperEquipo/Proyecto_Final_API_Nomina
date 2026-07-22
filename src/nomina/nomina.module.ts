import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { NominaService } from './nomina.service';
import { NominaController } from './nomina.controller';
import { NominaCalculoService } from './nomina-calculo.service';
import { Empleado } from '../empleados/entities/empleado.entity';
import { HistorialSalario } from '../empleados/entities/historial-salario.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { DeduccionesModule } from '../deducciones/deducciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Nomina,
      DetalleNomina,
      Empleado,
      HistorialSalario,
      Novedad,
    ]),
    DeduccionesModule,
  ],
  controllers: [NominaController],
  providers: [NominaService, NominaCalculoService],
  exports: [NominaService, TypeOrmModule],
})
export class NominaModule {}
