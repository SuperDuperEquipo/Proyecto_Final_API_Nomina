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
  cicloVacaciones: number | null;
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

  /**
   * Construye una fecha sumando años a la fecha de ingreso.
   *
   * Ejemplo:
   * fechaIngreso = 2024-03-10
   * cantidadAnios = 2
   * resultado = 2026-03-10
   */
  private sumarAnios(
    fecha: Date,
    cantidadAnios: number,
  ): Date {
    return new Date(
      fecha.getFullYear() +
        cantidadAnios,
      fecha.getMonth(),
      fecha.getDate(),
    );
  }

  private calcularAniosServicio(
    fechaIngreso: Date,
    fechaCorte: Date,
  ): number {
    let anios =
      fechaCorte.getFullYear() -
      fechaIngreso.getFullYear();

    const aniversarioActual =
      this.sumarAnios(
        fechaIngreso,
        anios,
      );

    if (
      fechaCorte <
      aniversarioActual
    ) {
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
      diasCalendario -
        permisosSinGoce,
      0,
    );
  }

  /**
   * Obtiene el último ciclo de vacaciones normales
   * que ya fue pagado al empleado.
   *
   * Si nunca ha recibido vacaciones normales,
   * devuelve 0.
   */
  private async obtenerUltimoCicloPagado(
    empleadoId: number,
  ): Promise<number> {
    const resultado =
      await this.detalleNominaRepository
        .createQueryBuilder('detalle')
        .innerJoin(
          'detalle.nomina',
          'nomina',
        )
        .select(
          'MAX(detalle.cicloVacaciones)',
          'ultimoCiclo',
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
          'nomina.motivoVacaciones = :motivo',
          {
            motivo:
              MotivoVacaciones.PERIODO_NORMAL,
          },
        )
        .andWhere(
          'detalle.cicloVacaciones IS NOT NULL',
        )
        .getRawOne<{
          ultimoCiclo:
            | string
            | number
            | null;
        }>();

    if (
      !resultado ||
      resultado.ultimoCiclo === null
    ) {
      return 0;
    }

    return Number(
      resultado.ultimoCiclo,
    );
  }

  /**
   * Verifica si un ciclo laboral específico ya fue pagado.
   */
  private async cicloVacacionesYaPagado(
    empleadoId: number,
    cicloVacaciones: number,
  ): Promise<boolean> {
    const cantidad =
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
          'nomina.motivoVacaciones = :motivo',
          {
            motivo:
              MotivoVacaciones.PERIODO_NORMAL,
          },
        )
        .andWhere(
          'detalle.cicloVacaciones = :cicloVacaciones',
          {
            cicloVacaciones,
          },
        )
        .getCount();

    return cantidad > 0;
  }

  /**
   * Calcula las vacaciones correspondientes al siguiente
   * ciclo laboral pendiente del empleado.
   *
   * Para vacaciones normales:
   *
   * - El ciclo 1 se habilita en fechaIngreso + 1 año.
   * - El ciclo 2 se habilita en fechaIngreso + 2 años.
   * - El ciclo 3 se habilita en fechaIngreso + 3 años.
   *
   * Cuando el siguiente aniversario todavía no ha llegado,
   * devuelve null y el empleado se omite.
   */
  private async calcularMontoVacaciones(
    nomina: Nomina,
    empleado: Empleado,
    fechaCorte: Date,
  ): Promise<ResultadoVacaciones | null> {
    const fechaIngreso = new Date(
      empleado.fechaIngreso,
    );

    const motivo =
      nomina.motivoVacaciones ??
      MotivoVacaciones.PERIODO_NORMAL;

    let diasPagados = 0;
    let esProporcional = false;
    let cicloVacaciones:
      | number
      | null = null;

    if (
      motivo ===
      MotivoVacaciones.PERIODO_NORMAL
    ) {
      const ultimoCicloPagado =
        await this.obtenerUltimoCicloPagado(
          empleado.id,
        );

      const siguienteCiclo =
        ultimoCicloPagado + 1;

      const fechaInicioCiclo =
        this.sumarAnios(
          fechaIngreso,
          siguienteCiclo - 1,
        );

      const fechaFinCiclo =
        this.sumarAnios(
          fechaIngreso,
          siguienteCiclo,
        );

      /*
       * El ciclo todavía no se ha completado.
       *
       * Ejemplo:
       * fechaIngreso: 10/03/2024
       * siguiente ciclo: 2
       * fecha habilitada: 10/03/2026
       *
       * Antes del 10/03/2026 no puede procesarse el Año 2.
       */
      if (
        fechaCorte <
        fechaFinCiclo
      ) {
        return null;
      }

      const yaFuePagado =
        await this.cicloVacacionesYaPagado(
          empleado.id,
          siguienteCiclo,
        );

      if (yaFuePagado) {
        return null;
      }

      const diasTrabajadosCiclo =
        await this.calcularDiasTrabajados(
          empleado.id,
          fechaInicioCiclo,
          fechaFinCiclo,
        );

      if (
        diasTrabajadosCiclo < 200
      ) {
        return null;
      }

      diasPagados = 15;
      cicloVacaciones =
        siguienteCiclo;
    }

    if (
      motivo ===
      MotivoVacaciones.VACACION_COLECTIVA
    ) {
      const aniosServicio =
        this.calcularAniosServicio(
          fechaIngreso,
          fechaCorte,
        );

      const fechaInicioCiclo =
        aniosServicio > 0
          ? this.sumarAnios(
              fechaIngreso,
              aniosServicio,
            )
          : fechaIngreso;

      const diasTrabajadosCiclo =
        await this.calcularDiasTrabajados(
          empleado.id,
          fechaInicioCiclo,
          fechaCorte,
        );

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
      const aniosServicio =
        this.calcularAniosServicio(
          fechaIngreso,
          fechaCorte,
        );

      const fechaInicioCiclo =
        aniosServicio > 0
          ? this.sumarAnios(
              fechaIngreso,
              aniosServicio,
            )
          : fechaIngreso;

      const diasTrabajadosCiclo =
        await this.calcularDiasTrabajados(
          empleado.id,
          fechaInicioCiclo,
          fechaCorte,
        );

      diasPagados =
        15 *
        Math.min(
          diasTrabajadosCiclo / 365,
          1,
        );

      esProporcional = true;
    }

    if (diasPagados <= 0) {
      return null;
    }

    const salarioDiario =
      Number(empleado.salarioBase) /
      30;

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
      cicloVacaciones,
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

      /*
       * El empleado no tiene un ciclo disponible,
       * no cumple los requisitos o ya recibió
       * el ciclo correspondiente.
       */
      if (
        resultadoVacaciones === null
      ) {
        continue;
      }

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

          cicloVacaciones:
            resultadoVacaciones
              .cicloVacaciones,

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

      const detalleGuardado =
        await this.detalleNominaRepository.save(
          detalle,
        );

      detalles.push(
        detalleGuardado,
      );
    }

    return detalles;
  }
}