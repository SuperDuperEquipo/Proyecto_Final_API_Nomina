import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NovedadesService } from './novedades.service';
import { NovedadesController } from './novedades.controller';
import { Novedad } from './entities/novedad.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Nomina } from '../nomina/entities/nomina.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Novedad, Empleado, Nomina])],
  controllers: [NovedadesController],
  providers: [NovedadesService],
  exports: [NovedadesService, TypeOrmModule],
})
export class NovedadesModule {}
