import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DetalleNomina } from '../nomina/entities/detalle-nomina.entity';
import { Nomina } from '../nomina/entities/nomina.entity';
import {
  Empleado,
  EmpleadoRole,
} from '../empleados/entities/empleado.entity';
import { TipoNomina } from '../nomina/enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../nomina/enums/subtipo-nomina-especial.enum';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';

@Injectable()
export class ComprobanteService {
  constructor(
    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,

    @InjectRepository(Nomina)
    private readonly nominaRepository: Repository<Nomina>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  private validarAccesoPropio(
    usuario: {
      id: number;
      rol: EmpleadoRole;
    },
    empleadoId: number,
  ): void {
    if (
      usuario.rol ===
        EmpleadoRole.EMPLEADO &&
      usuario.id !== empleadoId
    ) {
      throw new ForbiddenException(
        'Solo puedes consultar tu propio comprobante.',
      );
    }
  }

  async obtenerComprobante(
    nominaId: number,
    empleadoId: number,
    usuario: {
      id: number;
      rol: EmpleadoRole;
    },
  ) {
    this.validarAccesoPropio(
      usuario,
      empleadoId,
    );

    const nomina =
      await this.nominaRepository.findOneBy({
        id: nominaId,
      });

    if (!nomina) {
      throw new NotFoundException(
        `Nómina con ID "${nominaId}" no encontrada.`,
      );
    }

    if (
      nomina.estado ===
      EstadoNomina.ABIERTA
    ) {
      throw new ConflictException(
        'Los comprobantes solo están disponibles cuando la nómina está CERRADA o APROBADA.',
      );
    }

    const empleado =
      await this.empleadoRepository.findOneBy({
        id: empleadoId,
      });

    if (!empleado) {
      throw new NotFoundException(
        `Empleado con ID "${empleadoId}" no encontrado.`,
      );
    }

    const detalle =
      await this.detalleNominaRepository.findOneBy({
        nominaId,
        empleadoId,
      });

    if (!detalle) {
      throw new NotFoundException(
        `No existe un comprobante para el empleado "${empleadoId}" en la nómina "${nominaId}".`,
      );
    }

    const datosGenerales = {
      nomina: {
        id: nomina.id,
        periodo: nomina.periodo,
        tipo: nomina.tipo,
        subtipoEspecial:
          nomina.subtipoEspecial,
        estado: nomina.estado,
      },
      empleado: {
        id: empleado.id,
        nombre: empleado.nombre,
        documentoIdentidad:
          empleado.documentoIdentidad,
        cargo: empleado.cargo,
        area: empleado.area,
      },
    };

    if (
      nomina.tipo ===
      TipoNomina.REGULAR
    ) {
      return {
        ...datosGenerales,
        tipoComprobante: 'SALARIO',
        ingresos: {
          salarioBase:
            detalle.salarioBase,
          horasExtra:
            detalle.montoHorasExtra,
          bonificaciones:
            detalle.montoBonificaciones,
          totalIngresos:
            detalle.totalDevengado,
        },
        deducciones: {
          isss:
            detalle.issssTrabajador,
          afp:
            detalle.afpTrabajador,
          isr: detalle.isr,
          otrosDescuentos:
            detalle.montoDescuentos,
          totalDeducciones:
            detalle.totalDeducciones,
        },
        liquidoAPagar:
          detalle.liquidoAPagar,
      };
    }

    if (
      nomina.subtipoEspecial ===
      SubtipoNominaEspecial.AGUINALDO
    ) {
      return {
        ...datosGenerales,
        tipoComprobante:
          'AGUINALDO',
        prestacion: {
          concepto: 'Aguinaldo',
          monto:
            detalle.totalDevengado,
        },
        deducciones: {
          isss: 0,
          afp: 0,
          isr: detalle.isr,
          totalDeducciones:
            detalle.totalDeducciones,
        },
        liquidoAPagar:
          detalle.liquidoAPagar,
      };
    }

    if (
      nomina.subtipoEspecial ===
      SubtipoNominaEspecial.VACACIONES
    ) {
      return {
        ...datosGenerales,
        tipoComprobante:
          'VACACIONES',
        prestacion: {
          concepto:
            'Vacaciones más prima vacacional',
          diasPagados:
            detalle.diasPrestacion,
          esProporcional:
            detalle.prestacionProporcional,
          monto:
            detalle.montoPrestacion,
        },
        deducciones: {
          isss:
            detalle.issssTrabajador,
          afp:
            detalle.afpTrabajador,
          isr: detalle.isr,
          totalDeducciones:
            detalle.totalDeducciones,
        },
        liquidoAPagar:
          detalle.liquidoAPagar,
      };
    }

    return {
      ...datosGenerales,
      tipoComprobante:
        nomina.subtipoEspecial,
      totalIngresos:
        detalle.totalDevengado,
      totalDeducciones:
        detalle.totalDeducciones,
      liquidoAPagar:
        detalle.liquidoAPagar,
    };
  }

  async listarComprobantesDeNomina(
    nominaId: number,
  ) {
    const nomina =
      await this.nominaRepository.findOneBy({
        id: nominaId,
      });

    if (!nomina) {
      throw new NotFoundException(
        `Nómina con ID "${nominaId}" no encontrada.`,
      );
    }

    if (
      nomina.estado ===
      EstadoNomina.ABIERTA
    ) {
      throw new ConflictException(
        'La nómina debe estar CERRADA o APROBADA para listar sus comprobantes.',
      );
    }

    return this.detalleNominaRepository.find({
      where: {
        nominaId,
      },
      relations: {
        empleado: true,
      },
      order: {
        empleadoId: 'ASC',
      },
    });
  }
}
