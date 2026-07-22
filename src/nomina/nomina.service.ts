import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { CreateNominaDto } from './dto/create-nomina.dto';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from './enums/subtipo-nomina-especial.enum';
import { MotivoVacaciones } from './enums/motivo-vacaciones.enum';
import { NominaCalculoService } from './nomina-calculo.service';
import { NominaEspecialCalculoService } from './nomina-especial-calculo.service';

@Injectable()
export class NominaService {
  constructor(
    @InjectRepository(Nomina)
    private readonly nominaRepository: Repository<Nomina>,

    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,

    private readonly nominaCalculoService: NominaCalculoService,
    private readonly nominaEspecialCalculoService: NominaEspecialCalculoService,
  ) {}

  async create(createNominaDto: CreateNominaDto): Promise<Nomina> {
    const tipo = createNominaDto.tipo ?? TipoNomina.REGULAR;

    this.validarConfiguracion(tipo, createNominaDto);

    const nomina = this.nominaRepository.create({
      periodo: createNominaDto.periodo,
      tipo,
      subtipoEspecial:
        tipo === TipoNomina.ESPECIAL
          ? createNominaDto.subtipoEspecial!
          : null,
      motivoVacaciones:
        createNominaDto.subtipoEspecial ===
        SubtipoNominaEspecial.VACACIONES
          ? createNominaDto.motivoVacaciones ??
            MotivoVacaciones.PERIODO_NORMAL
          : null,
      estado: EstadoNomina.ABIERTA,
      fechaAprobacion: null,
    });

    return this.nominaRepository.save(nomina);
  }

  private validarConfiguracion(
    tipo: TipoNomina,
    dto: CreateNominaDto,
  ): void {
    if (tipo === TipoNomina.REGULAR) {
      if (dto.subtipoEspecial || dto.motivoVacaciones) {
        throw new BadRequestException(
          'Una nómina REGULAR no puede contener subtipoEspecial ni motivoVacaciones',
        );
      }

      return;
    }

    if (!dto.subtipoEspecial) {
      throw new BadRequestException(
        'subtipoEspecial es obligatorio cuando tipo es ESPECIAL.',
      );
    }

    if (
      dto.subtipoEspecial !== SubtipoNominaEspecial.VACACIONES &&
      dto.motivoVacaciones
    ) {
      throw new BadRequestException(
        'motivoVacaciones solamente aplica a una nómina especial de VACACIONES.',
      );
    }
  }

  async findAll(filtros?: {
    estado?: EstadoNomina;
    tipo?: TipoNomina;
    periodo?: string;
  }): Promise<Nomina[]> {
    const where: Record<string, unknown> = {};

    if (filtros?.estado) {
      where.estado = filtros.estado;
    }

    if (filtros?.tipo) {
      where.tipo = filtros.tipo;
    }

    if (filtros?.periodo) {
      where.periodo = filtros.periodo;
    }

    return this.nominaRepository.find({
      where,
      order: {
        id: 'DESC',
      },
    });
  }

  async findOne(id: number): Promise<Nomina> {
    const nomina = await this.nominaRepository.findOneBy({
      id,
    });

    if (!nomina) {
      throw new NotFoundException(
        `Nómina con ID "${id}" no encontrada.`,
      );
    }

    return nomina;
  }

  async cerrar(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);

    if (nomina.estado !== EstadoNomina.ABIERTA) {
      throw new ConflictException(
        `No se puede cerrar la nómina "${nomina.periodo}": está en estado ${nomina.estado}, no ABIERTA.`,
      );
    }

    if (nomina.tipo === TipoNomina.REGULAR) {
      await this.nominaCalculoService.calcularPeriodoRegular(
        nomina,
      );
    } else if (
      nomina.subtipoEspecial ===
      SubtipoNominaEspecial.VACACIONES
    ) {
      await this.nominaEspecialCalculoService.calcularNominaEspecial(
        nomina,
      );
    }

    const cantidadDetalles =
      await this.detalleNominaRepository.count({
        where: {
          nominaId: nomina.id,
        },
      });

    if (cantidadDetalles === 0) {
      throw new ConflictException(
        'La nómina no puede cerrarse porque no generó ningún DetalleNomina.',
      );
    }

    nomina.estado = EstadoNomina.CERRADA;

    return this.nominaRepository.save(nomina);
  }

  async obtenerDetalle(id: number): Promise<DetalleNomina[]> {
    await this.findOne(id);

    return this.detalleNominaRepository.find({
      where: {
        nominaId: id,
      },
      relations: {
        empleado: true,
      },
      order: {
        empleadoId: 'ASC',
      },
    });
  }

  async reabrir(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);

    if (nomina.estado === EstadoNomina.APROBADA) {
      throw new ConflictException(
        `No se puede reabrir la nómina "${nomina.periodo}": ya está APROBADA.`,
      );
    }

    if (nomina.estado !== EstadoNomina.CERRADA) {
      throw new ConflictException(
        `No se puede reabrir la nómina "${nomina.periodo}": está en estado ${nomina.estado}, no CERRADA.`,
      );
    }

    await this.detalleNominaRepository.delete({
      nominaId: nomina.id,
    });

    nomina.estado = EstadoNomina.ABIERTA;

    return this.nominaRepository.save(nomina);
  }

  async aprobar(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);

    if (nomina.estado === EstadoNomina.APROBADA) {
      throw new ConflictException(
        `La nómina "${nomina.periodo}" ya está APROBADA.`,
      );
    }

    if (nomina.estado !== EstadoNomina.CERRADA) {
      throw new ConflictException(
        `No se puede aprobar la nómina "${nomina.periodo}": debe estar CERRADA primero.`,
      );
    }

    const cantidadDetalles =
      await this.detalleNominaRepository.count({
        where: {
          nominaId: nomina.id,
        },
      });

    if (cantidadDetalles === 0) {
      throw new ConflictException(
        'No se puede aprobar una nómina sin detalles de pago.',
      );
    }

    nomina.estado = EstadoNomina.APROBADA;
    nomina.fechaAprobacion = new Date();

    return this.nominaRepository.save(nomina);
  }

  async remove(id: number): Promise<void> {
    const nomina = await this.findOne(id);

    if (nomina.estado !== EstadoNomina.ABIERTA) {
      throw new ConflictException(
        `No se puede eliminar la nómina "${nomina.periodo}": está en estado ${nomina.estado}, no ABIERTA.`,
      );
    }

    await this.detalleNominaRepository.delete({
      nominaId: id,
    });

    await this.nominaRepository.delete(id);
  }
}