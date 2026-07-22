import { Module } from '@nestjs/common';
import { ComprobantesController } from './comprobantes.controller';
import { ComprobanteService } from './comprobante.service';
import { ReportesService } from './reportes.service';
import { EmpleadosModule } from '../empleados/empleados.module';
import { NominaModule } from '../nomina/nomina.module';

@Module({
  imports: [
    EmpleadosModule,
    NominaModule,
  ],
  controllers: [
    ComprobantesController,
  ],
  providers: [
    ComprobanteService,
    ReportesService,
  ],
})
export class ComprobantesModule {}