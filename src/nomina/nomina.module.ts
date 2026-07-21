import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nomina } from './entities/nomina.entity';


@Module({
  imports: [TypeOrmModule.forFeature([Nomina])],
  exports: [TypeOrmModule],
})
export class NominaModule {}
