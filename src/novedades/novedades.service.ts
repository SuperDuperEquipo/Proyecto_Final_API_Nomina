import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { UpdateNovedadDto } from './dto/update-novedad.dto';
import { Novedad } from './entities/novedad.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Nomina } from '../nomina/entities/nomina.entity';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';
import { TipoNovedad } from './enums/tipo-novedad.enum';

@Injectable()
export class NovedadesService {
  constructor(
    @InjectRepository(Novedad)
    private readonly novedadRepository: Repository<Novedad>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Nomina)
    private readonly nominaRepository: Repository<Nomina>,
  ) {}

  //Verifica que el empleado y la nómina existan y que la nómina esté abierta
  private async validarEmpleadoYNominaAbierta(
    empleadoId: number,
    nominaId: number,
  ): Promise<Nomina> {
    const empleado = await this.empleadoRepository.findOneBy({ id: empleadoId });
    if (!empleado) {
      throw new NotFoundException(`Empleado con ID "${empleadoId}" no encontrado.`);
    }

    const nomina = await this.nominaRepository.findOneBy({ id: nominaId });
    if (!nomina) {
      throw new NotFoundException(`Nómina con ID "${nominaId}" no encontrada.`);
    }

    if (nomina.estado !== EstadoNomina.ABIERTA) {
      throw new ConflictException(
        `No se puede registrar ni modificar una novedad: la nómina "${nomina.periodo}" está en estado ${nomina.estado}, no ABIERTA.`,
      );
    }

    return nomina;
  }

  async create(createNovedadDto: CreateNovedadDto): Promise<Novedad> {
    await this.validarEmpleadoYNominaAbierta(
      createNovedadDto.empleadoId,
      createNovedadDto.nominaId,
    );

    // licencia de maternidad nunca debe restar de la base de prestaciones
    const afectaBasePrestaciones =
      createNovedadDto.tipo === TipoNovedad.LICENCIA_MATERNIDAD
        ? false
        : (createNovedadDto.afectaBasePrestaciones ?? false);

    const novedad = this.novedadRepository.create({
      ...createNovedadDto,
      fecha: new Date(createNovedadDto.fecha),
      afectaBasePrestaciones,
    });

    return this.novedadRepository.save(novedad);
  }

  async findAll(filtros?: { empleadoId?: number; nominaId?: number; tipo?: TipoNovedad }): Promise<Novedad[]> {
    const where: Record<string, unknown> = {};
    if (filtros?.empleadoId) where.empleadoId = filtros.empleadoId;
    if (filtros?.nominaId) where.nominaId = filtros.nominaId;
    if (filtros?.tipo) where.tipo = filtros.tipo;

    return this.novedadRepository.find({ where, order: { fecha: 'DESC' } });
  }

  async findOne(id: number): Promise<Novedad> {
    const novedad = await this.novedadRepository.findOneBy({ id });
    if (!novedad) {
      throw new NotFoundException(`Novedad con ID "${id}" no encontrada.`);
    }
    return novedad;
  }

  async findByNomina(nominaId: number): Promise<Novedad[]> {
    const nomina = await this.nominaRepository.findOneBy({ id: nominaId });
    if (!nomina) {
      throw new NotFoundException(`Nómina con ID "${nominaId}" no encontrada.`);
    }
    return this.novedadRepository.find({ where: { nominaId }, order: { empleadoId: 'ASC' } });
  }

  async update(id: number, updateNovedadDto: UpdateNovedadDto): Promise<Novedad> {
    const novedad = await this.findOne(id);

    // Revalida el estado de la nómina en el momento de la edición
    await this.validarEmpleadoYNominaAbierta(novedad.empleadoId, novedad.nominaId);

    const tipo = updateNovedadDto.tipo ?? novedad.tipo;
    const afectaBasePrestaciones =
      tipo === TipoNovedad.LICENCIA_MATERNIDAD
        ? false
        : (updateNovedadDto.afectaBasePrestaciones ?? novedad.afectaBasePrestaciones);

    const { fecha, ...resto } = updateNovedadDto;

    Object.assign(novedad, {
      ...resto,
      ...(fecha ? { fecha: new Date(fecha) } : {}),
      afectaBasePrestaciones,
    });

    return this.novedadRepository.save(novedad);
  }

  async remove(id: number): Promise<void> {
    const novedad = await this.findOne(id);
    await this.validarEmpleadoYNominaAbierta(novedad.empleadoId, novedad.nominaId);
    await this.novedadRepository.delete(id);
  }
}
