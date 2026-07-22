import {
  Injectable,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';
import { SubtipoNominaEspecial } from './enums/subtipo-nomina-especial.enum';
import { MotivoVacaciones } from './enums/motivo-vacaciones.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';
import { ConfiguracionVigenteService } from '../deducciones/configuracion-vigente.service';
import { IsssAfpCalculoService } from '../deducciones/isss-afp-calculo.service';
import { IsrCalculoService } from '../deducciones/isr-calculo.service';
import { redondearComercial } from '../common/utils/redondeo.util';

interface ResultadoVacaciones {
  montoBruto: number;
  diasPagados: number;
  esProporcional: boolean;
}

@Injectable()
export class NominaEspecialCalculoService {
  constructor(
    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,

    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,

    @InjectRepository(Novedad)
    private readonly novedadRepository: Repository<Novedad>,

    private readonly configuracionVigenteService: ConfiguracionVigenteService,
    private readonly issssAfpCalculoService: IsssAfpCalculoService,
    private readonly isrCalculoService: IsrCalculoService,
  ) {}

  async calcularNominaEspecial(
    nomina: Nomina,
  ): Promise<DetalleNomina[]> {
    if (nomina.tipo !== TipoNomina.ESPECIAL) {
      throw new ConflictException(
        'El cálculo de vacaciones solo puede ejecutarse sobre una nómina ESPECIAL.',
      );
    }

    if (
      nomina.subtipoEspecial !==
      SubtipoNominaEspecial.VACACIONES
    ) {
      throw new ConflictException(
        'Este servicio solamente calcula nóminas especiales de VACACIONES.',
      );
    }

    await this.detalleNominaRepository.delete({
      nominaId: nomina.id,
    });

    return this.calcularVacaciones(nomina);
  }

  private obtenerFechaPagoEspecial(
    periodo: string,
  ): Date {
    const match =
      /^(\d{4})-(\d{2})-(\d{2})$/.exec(
        periodo,
      );

    if (!match) {
      throw new ConflictException(
        `Formato de período inválido para nómina ESPECIAL: "${periodo}". Se espera AAAA-MM-DD.`,
      );
    }

    const anio = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);
    const fecha = new Date(
      anio,
      mes - 1,
      dia,
    );

    if (
      fecha.getFullYear() !== anio ||
      fecha.getMonth() !== mes - 1 ||
      fecha.getDate() !== dia
    ) {
      throw new ConflictException(
        `La fecha de pago "${periodo}" no es una fecha calendario válida.`,
      );
    }

    return fecha;
  }

  private async obtenerEmpleados(
    fechaCorte: Date,
  ): Promise<Empleado[]> {
    return this.empleadoRepository.find({
      where: {
        fechaIngreso:
          LessThanOrEqual(fechaCorte),
      },
      order: {
        id: 'ASC',
      },
    });
  }

  private calcularAniosServicio(
    fechaIngreso: Date,
    fechaCorte: Date,
  ): number {
    let anios =
      fechaCorte.getFullYear() -
      fechaIngreso.getFullYear();

    const aniversario = new Date(
      fechaCorte.getFullYear(),
      fechaIngreso.getMonth(),
      fechaIngreso.getDate(),
    );

    if (fechaCorte < aniversario) {
      anios -= 1;
    }

    return Math.max(anios, 0);
  }

  private calcularDiasEntre(
    fechaInicio: Date,
    fechaFin: Date,
  ): number {
    if (fechaInicio > fechaFin) {
      return 0;
    }

    return (
      Math.floor(
        (fechaFin.getTime() -
          fechaInicio.getTime()) /
          86_400_000,
      ) + 1
    );
  }

  private async calcularDiasTrabajados(
    empleadoId: number,
    fechaInicio: Date,
    fechaFin: Date,
  ): Promise<number> {
    const diasCalendario =
      this.calcularDiasEntre(
        fechaInicio,
        fechaFin,
      );

    const permisosSinGoce =
      await this.novedadRepository.count({
        where: {
          empleadoId,
          tipo:
            TipoNovedad.PERMISO_SIN_GOCE,
          fecha: Between(
            fechaInicio,
            fechaFin,
          ),
        },
      });

    return Math.max(
      diasCalendario - permisosSinGoce,
      0,
    );
  }

  private async yaRecibioVacaciones(
    empleadoId: number,
    periodo: string,
  ): Promise<boolean> {
    const detalle =
      await this.detalleNominaRepository
        .createQueryBuilder('detalle')
        .innerJoin(
          'detalle.nomina',
          'nomina',
        )
        .where(
          'detalle.empleadoId = :empleadoId',
          {
            empleadoId,
          },
        )
        .andWhere(
          'nomina.tipo = :tipo',
          {
            tipo: TipoNomina.ESPECIAL,
          },
        )
        .andWhere(
          'nomina.subtipoEspecial = :subtipo',
          {
            subtipo:
              SubtipoNominaEspecial.VACACIONES,
          },
        )
        .andWhere(
          'nomina.periodo = :periodo',
          {
            periodo,
          },
        )
        .getOne();

    return !!detalle;
  }

  private async calcularMontoVacaciones(
    nomina: Nomina,
    empleado: Empleado,
    fechaCorte: Date,
  ): Promise<ResultadoVacaciones> {
    const fechaIngreso = new Date(
      empleado.fechaIngreso,
    );

    const aniosServicio =
      this.calcularAniosServicio(
        fechaIngreso,
        fechaCorte,
      );

    const ultimoAniversario =
      aniosServicio > 0
        ? new Date(
            fechaIngreso.getFullYear() +
              aniosServicio,
            fechaIngreso.getMonth(),
            fechaIngreso.getDate(),
          )
        : fechaIngreso;

    const diasTrabajadosCiclo =
      await this.calcularDiasTrabajados(
        empleado.id,
        ultimoAniversario,
        fechaCorte,
      );

    const yaRecibio =
      await this.yaRecibioVacaciones(
        empleado.id,
        nomina.periodo,
      );

    if (yaRecibio) {
      throw new ConflictException(
        `El empleado "${empleado.nombre}" ya recibió el pago de vacaciones correspondiente para el período ${nomina.periodo}.`,
      );
    }

    const motivo =
      nomina.motivoVacaciones ??
      MotivoVacaciones.PERIODO_NORMAL;

    let diasPagados = 0;
    let esProporcional = false;

    if (
      motivo ===
      MotivoVacaciones.PERIODO_NORMAL
    ) {
      if (
        aniosServicio < 1 ||
        diasTrabajadosCiclo < 200
      ) {
        throw new ConflictException(
          `El empleado "${empleado.nombre}" no cumple los requisitos para vacaciones normales. Años completos: ${aniosServicio}; días trabajados en el ciclo: ${diasTrabajadosCiclo}.`,
        );
      }

      diasPagados = 15;
    }

    if (
      motivo ===
      MotivoVacaciones.VACACION_COLECTIVA
    ) {
      if (aniosServicio >= 1) {
        diasPagados = 15;
      } else {
        diasPagados =
          15 *
          Math.min(
            diasTrabajadosCiclo / 365,
            1,
          );

        esProporcional = true;
      }
    }

    if (
      motivo ===
      MotivoVacaciones.TERMINACION_CONTRATO
    ) {
      diasPagados =
        15 *
        Math.min(
          diasTrabajadosCiclo / 365,
          1,
        );

      esProporcional = true;
    }

    const salarioDiario =
      Number(empleado.salarioBase) / 30;

    const montoBruto =
      redondearComercial(
        salarioDiario *
          diasPagados *
          1.3,
      );

    return {
      montoBruto,
      diasPagados:
        redondearComercial(
          diasPagados,
        ),
      esProporcional,
    };
  }

  private async calcularVacaciones(
    nomina: Nomina,
  ): Promise<DetalleNomina[]> {
    const fechaCorte =
      this.obtenerFechaPagoEspecial(
        nomina.periodo,
      );

    const empleados =
      await this.obtenerEmpleados(
        fechaCorte,
      );

    const configuracion =
      await this.configuracionVigenteService
        .obtenerConfiguracionVigente(
          fechaCorte,
        );

    const tramosIsr =
      await this.configuracionVigenteService
        .obtenerTramosIsrVigentes(
          fechaCorte,
        );

    const detalles: DetalleNomina[] = [];

    for (const empleado of empleados) {
      const resultadoVacaciones =
        await this.calcularMontoVacaciones(
          nomina,
          empleado,
          fechaCorte,
        );

      const montoVacaciones =
        resultadoVacaciones.montoBruto;

      const resultadoIsssAfp =
        this.issssAfpCalculoService.calcular(
          montoVacaciones,
          montoVacaciones,
          configuracion,
        );

      const baseIsrGravable =
        redondearComercial(
          Math.max(
            montoVacaciones -
              resultadoIsssAfp
                .issssTrabajador -
              resultadoIsssAfp
                .afpTrabajador,
            0,
          ),
        );

      const isr =
        this.isrCalculoService.calcular(
          baseIsrGravable,
          tramosIsr,
        );

      const totalDeducciones =
        redondearComercial(
          resultadoIsssAfp
            .issssTrabajador +
            resultadoIsssAfp
              .afpTrabajador +
            isr,
        );

      const liquidoAPagar =
        redondearComercial(
          montoVacaciones -
            totalDeducciones,
        );

      const detalle =
        this.detalleNominaRepository.create({
          nominaId: nomina.id,
          empleadoId: empleado.id,

          salarioBase: 0,
          montoHorasExtra: 0,
          montoBonificaciones: 0,
          montoPrestacion:
            montoVacaciones,
          diasPrestacion:
            resultadoVacaciones
              .diasPagados,
          prestacionProporcional:
            resultadoVacaciones
              .esProporcional,

          montoDescuentos: 0,
          totalDevengado:
            montoVacaciones,

          baseIsss:
            montoVacaciones,
          baseAfp:
            montoVacaciones,
          baseIsrGravable,

          issssTrabajador:
            resultadoIsssAfp
              .issssTrabajador,
          issssPatronal:
            resultadoIsssAfp
              .issssPatronal,
          afpTrabajador:
            resultadoIsssAfp
              .afpTrabajador,
          afpPatronal:
            resultadoIsssAfp
              .afpPatronal,

          isr,
          totalDeducciones,
          liquidoAPagar,
        });

      detalles.push(
        await this.detalleNominaRepository.save(
          detalle,
        ),
      );
    }

    return detalles;
  }
}
