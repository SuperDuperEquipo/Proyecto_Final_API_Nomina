import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';
import { ClasificacionDeduccionesService } from './clasificacion-deducciones.service';
import { ConfiguracionVigenteService } from './configuracion-vigente.service';
import { ConfiguracionAdminService } from './configuracion-admin.service';
import { IsssAfpCalculoService } from './isss-afp-calculo.service';
import { IsrCalculoService } from './isr-calculo.service';
import { DeduccionesController } from './deducciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ConfiguracionDeduccion, TramoISR])],
  controllers: [DeduccionesController],
  providers: [
    ClasificacionDeduccionesService,
    ConfiguracionVigenteService,
    ConfiguracionAdminService,
    IsssAfpCalculoService,
    IsrCalculoService,
  ],
  exports: [
    TypeOrmModule,
    ClasificacionDeduccionesService,
    ConfiguracionVigenteService,
    IsssAfpCalculoService,
    IsrCalculoService,
  ],
})
export class DeduccionesModule {}
