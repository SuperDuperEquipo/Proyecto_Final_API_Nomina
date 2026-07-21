import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThan, IsNull } from 'typeorm';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';

// Busca la fila vigente para una fecha: vigenteDesde <= fecha y
// (vigenteHasta > fecha o vigenteHasta es null)
@Injectable()
export class ConfiguracionVigenteService {
  constructor(
    @InjectRepository(ConfiguracionDeduccion)
    private readonly configRepo: Repository<ConfiguracionDeduccion>,
    @InjectRepository(TramoISR)
    private readonly tramoRepo: Repository<TramoISR>,
  ) {}

  async obtenerConfiguracionVigente(
    fecha: Date,
  ): Promise<ConfiguracionDeduccion> {
    const config = await this.configRepo.findOne({
      where: [
        { vigenteDesde: LessThanOrEqual(fecha), vigenteHasta: MoreThan(fecha) },
        { vigenteDesde: LessThanOrEqual(fecha), vigenteHasta: IsNull() },
      ],
      order: { vigenteDesde: 'DESC' },
    });

    if (!config) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: `Falta configurar las deducciones (ISSS/AFP) vigentes para la fecha ${fecha.toISOString().slice(0, 10)}`,
        error: 'CONFIGURACION_DEDUCCION_NOT_CONFIGURED',
      });
    }

    return config;
  }

  async obtenerTramosIsrVigentes(fecha: Date): Promise<TramoISR[]> {
    const tramos = await this.tramoRepo.find({
      where: [
        { vigenteDesde: LessThanOrEqual(fecha), vigenteHasta: MoreThan(fecha) },
        { vigenteDesde: LessThanOrEqual(fecha), vigenteHasta: IsNull() },
      ],
      order: { numeroTramo: 'ASC' },
    });

    if (!tramos.length) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: `Falta configurar los tramos de ISR vigentes para la fecha ${fecha.toISOString().slice(0, 10)}`,
        error: 'ISR_TRAMOS_NOT_CONFIGURED',
      });
    }

    return tramos;
  }
}
