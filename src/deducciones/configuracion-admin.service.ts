import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { TramoISR } from './entities/tramo-isr.entity';
import { CreateConfiguracionDeduccionDto } from './dto/create-configuracion-deduccion.dto';
import { CreateTramosIsrVigenciaDto } from './dto/create-tramos-isr-vigencia.dto';

// Servicio de escritura (CRUD administrativo)
@Injectable()
export class ConfiguracionAdminService {
  constructor(
    @InjectRepository(ConfiguracionDeduccion)
    private readonly configRepo: Repository<ConfiguracionDeduccion>,
    @InjectRepository(TramoISR)
    private readonly tramoRepo: Repository<TramoISR>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async crearConfiguracionDeduccion(
    dto: CreateConfiguracionDeduccionDto,
  ): Promise<ConfiguracionDeduccion> {
    const nuevaVigenteDesde = new Date(dto.vigenteDesde);

    return this.dataSource.transaction(async (manager) => {
      const actual = await manager.findOne(ConfiguracionDeduccion, {
        where: { vigenteHasta: IsNull() },
      });

      if (actual && nuevaVigenteDesde <= actual.vigenteDesde) {
        throw new ConflictException({
          statusCode: 409,
          message: `Ya existe una configuración vigente desde ${actual.vigenteDesde.toISOString().slice(0, 10)}. La nueva vigenteDesde debe ser posterior.`,
          error: 'CONFIGURACION_DEDUCCION_OVERLAP',
        });
      }

      if (actual) {
        actual.vigenteHasta = nuevaVigenteDesde;
        await manager.save(actual);
      }

      const nueva = manager.create(ConfiguracionDeduccion, {
        ...dto,
        vigenteDesde: nuevaVigenteDesde,
        vigenteHasta: null,
        afpTopeBase: dto.afpTopeBase ?? null,
      });
      return manager.save(nueva);
    });
  }

  async listarConfiguracionDeduccion(): Promise<ConfiguracionDeduccion[]> {
    return this.configRepo.find({ order: { vigenteDesde: 'DESC' } });
  }

  async crearTramosIsr(dto: CreateTramosIsrVigenciaDto): Promise<TramoISR[]> {
    this.validarTramosContiguos(dto);

    const nuevaVigenteDesde = new Date(dto.vigenteDesde);

    return this.dataSource.transaction(async (manager) => {
      const actuales = await manager.find(TramoISR, {
        where: { vigenteHasta: IsNull() },
      });

      if (actuales.length && nuevaVigenteDesde <= actuales[0].vigenteDesde) {
        throw new ConflictException({
          statusCode: 409,
          message: `Ya existe una tabla de ISR vigente desde ${actuales[0].vigenteDesde.toISOString().slice(0, 10)}. La nueva vigenteDesde debe ser posterior.`,
          error: 'TRAMO_ISR_OVERLAP',
        });
      }

      for (const tramo of actuales) {
        tramo.vigenteHasta = nuevaVigenteDesde;
      }
      if (actuales.length) {
        await manager.save(actuales);
      }

      const nuevos = dto.tramos.map((t) =>
        manager.create(TramoISR, {
          ...t,
          vigenteDesde: nuevaVigenteDesde,
          vigenteHasta: null,
          limiteSuperior: t.limiteSuperior ?? null,
        }),
      );
      return manager.save(nuevos);
    });
  }

  async listarTramosIsr(): Promise<TramoISR[]> {
    return this.tramoRepo.find({
      order: { vigenteDesde: 'DESC', numeroTramo: 'ASC' },
    });
  }

  // Valida que los 4 tramos estén completos, numerados 1-4 sin repetir
  private validarTramosContiguos(dto: CreateTramosIsrVigenciaDto) {
    const ordenados = [...dto.tramos].sort(
      (a, b) => a.numeroTramo - b.numeroTramo,
    );
    const numeros = ordenados.map((t) => t.numeroTramo);

    if (
      new Set(numeros).size !== 4 ||
      JSON.stringify(numeros) !== JSON.stringify([1, 2, 3, 4])
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message:
          'Los 4 tramos deben estar numerados 1, 2, 3 y 4, cada uno una sola vez.',
        error: 'TRAMOS_ISR_INVALIDOS',
      });
    }

    ordenados.forEach((tramo, i) => {
      const esUltimo = i === ordenados.length - 1;

      if (
        esUltimo &&
        tramo.limiteSuperior !== null &&
        tramo.limiteSuperior !== undefined
      ) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'El tramo 4 (el más alto) no debe tener limiteSuperior.',
          error: 'TRAMOS_ISR_INVALIDOS',
        });
      }
      if (
        !esUltimo &&
        (tramo.limiteSuperior === null || tramo.limiteSuperior === undefined)
      ) {
        throw new BadRequestException({
          statusCode: 400,
          message: `El tramo ${tramo.numeroTramo} debe tener limiteSuperior (solo el tramo 4 no lleva).`,
          error: 'TRAMOS_ISR_INVALIDOS',
        });
      }
      if (!esUltimo) {
        const siguiente = ordenados[i + 1];
        const esperado = Math.round((tramo.limiteSuperior! + 0.01) * 100) / 100;
        if (Math.round(siguiente.limiteInferior * 100) / 100 !== esperado) {
          throw new BadRequestException({
            statusCode: 400,
            message: `Hueco o solapamiento entre el tramo ${tramo.numeroTramo} y el ${siguiente.numeroTramo}: limiteInferior del siguiente tramo debe ser limiteSuperior + 0.01.`,
            error: 'TRAMOS_ISR_INVALIDOS',
          });
        }
      }
    });
  }
}
