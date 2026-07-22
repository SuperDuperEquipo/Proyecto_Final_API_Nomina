import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { CreateNominaDto } from './dto/create-nomina.dto';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';
import { NominaCalculoService } from './nomina-calculo.service';

@Injectable()
export class NominaService {
  constructor(
    @InjectRepository(Nomina)
    private readonly nominaRepository: Repository<Nomina>,
    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,
    private readonly nominaCalculoService: NominaCalculoService,
  ) {}

  async create(createNominaDto: CreateNominaDto): Promise<Nomina> {
    const nomina = this.nominaRepository.create({
      ...createNominaDto,
      tipo: createNominaDto.tipo ?? TipoNomina.REGULAR,
      estado: EstadoNomina.ABIERTA,
    });
    return this.nominaRepository.save(nomina);
  }

  async findAll(filtros?: {
    estado?: EstadoNomina;
    tipo?: TipoNomina;
    periodo?: string;
  }): Promise<Nomina[]> {
    const where: Record<string, unknown> = {};
    if (filtros?.estado) where.estado = filtros.estado;
    if (filtros?.tipo) where.tipo = filtros.tipo;
    if (filtros?.periodo) where.periodo = filtros.periodo;

    return this.nominaRepository.find({ where, order: { id: 'DESC' } });
  }

  async findOne(id: number): Promise<Nomina> {
    const nomina = await this.nominaRepository.findOneBy({ id });
    if (!nomina) {
      throw new NotFoundException(`Nómina con ID "${id}" no encontrada.`);
    }
    return nomina;
  }

  // ABIERTA -> CERRADA: congela el registro de novedades (P3 ya rechaza
  // creación/edición de novedades para cualquier estado distinto de ABIERTA)
  // y corre el motor de cálculo correspondiente. REGULAR combina salario
  // prorrateado + novedades + deducciones de ley; ESPECIAL (Quincena 25,
  // Aguinaldo) calcula el pago puntual a partir de salario y antigüedad,
  // sin consultar novedades (ver README de nómina).
  async cerrar(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);
    if (nomina.estado !== EstadoNomina.ABIERTA) {
      throw new ConflictException(
        `No se puede cerrar la nómina "${nomina.periodo}": está en estado ${nomina.estado}, no ABIERTA.`,
      );
    }

    if (nomina.tipo === TipoNomina.REGULAR) {
      await this.nominaCalculoService.calcularPeriodoRegular(nomina);
    } else {
      await this.nominaCalculoService.calcularNominaEspecial(nomina);
    }

    nomina.estado = EstadoNomina.CERRADA;
    return this.nominaRepository.save(nomina);
  }

  async obtenerDetalle(id: number): Promise<DetalleNomina[]> {
    await this.findOne(id); // valida que la nómina exista
    return this.detalleNominaRepository.find({
      where: { nominaId: id },
      order: { empleadoId: 'ASC' },
    });
  }

  // CERRADA -> ABIERTA: permite corregir novedades antes de aprobar.
  // Nunca permitido desde APROBADA (Art. 53.I: un pago ya devengado no se reduce retroactivamente)
  async reabrir(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);
    if (nomina.estado === EstadoNomina.APROBADA) {
      throw new ConflictException(
        `No se puede reabrir la nómina "${nomina.periodo}": ya está APROBADA y es inmutable (Art. 53.I Código de Trabajo).`,
      );
    }
    if (nomina.estado !== EstadoNomina.CERRADA) {
      throw new ConflictException(
        `No se puede reabrir la nómina "${nomina.periodo}": está en estado ${nomina.estado}, no CERRADA.`,
      );
    }
    nomina.estado = EstadoNomina.ABIERTA;
    return this.nominaRepository.save(nomina);
  }

  // CERRADA -> APROBADA: punto sin retorno. No hay reverso ni desde este propio
  // servicio, por diseño: reducir un pago ya devengado sin justa causa da al
  // trabajador derecho a terminar el contrato con responsabilidad patronal (Art. 53.I CT).
  async aprobar(id: number): Promise<Nomina> {
    const nomina = await this.findOne(id);
    if (nomina.estado === EstadoNomina.APROBADA) {
      throw new ConflictException(
        `La nómina "${nomina.periodo}" ya está APROBADA.`,
      );
    }
    if (nomina.estado !== EstadoNomina.CERRADA) {
      throw new ConflictException(
        `No se puede aprobar la nómina "${nomina.periodo}": debe estar CERRADA primero (está ${nomina.estado}).`,
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
    await this.nominaRepository.delete(id);
  }
}
