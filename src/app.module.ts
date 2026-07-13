import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmpleadosModule } from './empleados/empleados.module';
import { AuthModule } from './auth/auth.module';
import { DeduccionesModule } from './deducciones/deducciones.module';
import { NovedadesModule } from './novedades/novedades.module';
import { NominaModule } from './nomina/nomina.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';

@Module({
  imports: [EmpleadosModule, AuthModule, DeduccionesModule, NovedadesModule, NominaModule, ComprobantesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
