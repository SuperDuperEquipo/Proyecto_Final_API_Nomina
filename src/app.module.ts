import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EmpleadosModule } from './empleados/empleados.module';
import { AuthModule } from './auth/auth.module';
import { DeduccionesModule } from './deducciones/deducciones.module';
import { NovedadesModule } from './novedades/novedades.module';
import { NominaModule } from './nomina/nomina.module';
import { ComprobantesModule } from './comprobantes/comprobantes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
        username: configService.get<string>('DB_USER', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'password123'),
        database: configService.get<string>('DB_NAME', 'nomina_db'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    EmpleadosModule,
    AuthModule,
    DeduccionesModule,
    NovedadesModule,
    NominaModule,
    ComprobantesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
