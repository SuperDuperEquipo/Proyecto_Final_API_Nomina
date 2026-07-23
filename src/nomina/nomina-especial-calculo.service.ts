import {
  Injectable,
  ConflictException,
  NotFoundException,
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
  private readonly milisegundosPorDia =
    24 * 60 * 60 * 1000;

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
    if (
      nomina.tipo !== TipoNomina.ESPECIAL
    ) {
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

    /*
     * Si la nómina había sido calculada previamente y luego fue
     * reabierta, se eliminan únicamente sus detalles actuales.
     *
     * Los detalles pertenecientes a otras nóminas permanecen y
     * se utilizan para verificar pagos anteriores.
     */
    await this.detalleNominaRepository.delete({
      nominaId: nomina.id,
    });

    return this.calcularVacaciones(
      nomina,
    );
  }

  /**
   * Construye una fecha calendario en UTC.
   *
   * El uso de UTC evita que una fecha como 2024-03-10
   * pueda interpretarse localmente como 2024-03-09.
   */
  private crearFechaCalendario(
    anio: number,
    mes: number,
    dia: number,
  ): Date {
    return new Date(
      Date.UTC(
        anio,
        mes - 1,
        dia,
      ),
    );
  }

  private esFechaCalendarioValida(
    anio: number,
    mes: number,
    dia: number,
  ): boolean {
    const fecha =
      this.crearFechaCalendario(
        anio,
        mes,
        dia,
      );

    return (
      fecha.getUTCFullYear() === anio &&
      fecha.getUTCMonth() ===
        mes - 1 &&
      fecha.getUTCDate() === dia
    );
  }

  /**
   * Convierte una fecha proveniente de TypeORM a una fecha
   * calendario UTC sin conservar horas ni zona horaria.
   */
  private convertirFechaCalendario(
    valor: Date | string,
  ): Date {
    if (typeof valor === 'string') {
      const match =
        /^(\d{4})-(\d{2})-(\d{2})/.exec(
          valor,
        );

      if (!match) {
        throw new ConflictException(
          `Fecha laboral inválida: "${valor}". Se espera el formato AAAA-MM-DD.`,
        );
      }

      const anio = Number(match[1]);
      const mes = Number(match[2]);
      const dia = Number(match[3]);

      if (
        !this.esFechaCalendarioValida(
          anio,
          mes,
          dia,
        )
      ) {
        throw new ConflictException(
          `La fecha laboral "${valor}" no es una fecha calendario válida.`,
        );
      }

      return this.crearFechaCalendario(
        anio,
        mes,
        dia,
      );
    }

    if (
      !(valor instanceof Date) ||
      Number.isNaN(valor.getTime())
    ) {
      throw new ConflictException(
        'La fecha laboral recibida no es válida.',
      );
    }

    return this.crearFechaCalendario(
      valor.getUTCFullYear(),
      valor.getUTCMonth() + 1,
      valor.getUTCDate(),
    );
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

    if (
      !this.esFechaCalendarioValida(
        anio,
        mes,
        dia,
      )
    ) {
      throw new ConflictException(
        `La fecha de pago "${periodo}" no es una fecha calendario válida.`,
      );
    }

    return this.crearFechaCalendario(
      anio,
      mes,
      dia,
    );
  }

  /**
   * Extrae el año de una nómina especial cuyo período
   * se encuentra en formato AAAA-MM-DD.
   */
  private obtenerAnioPeriodoEspecial(
    periodo: string,
  ): number {
    return this.obtenerFechaPagoEspecial(
      periodo,
    ).getUTCFullYear();
  }

  private obtenerUltimoDiaMes(
    anio: number,
    mes: number,
  ): number {
    return new Date(
      Date.UTC(
        anio,
        mes,
        0,
      ),
    ).getUTCDate();
  }

  /**
   * Suma años conservando el aniversario laboral.
   *
   * Si la fecha de ingreso es el 29 de febrero y el año
   * de destino no es bisiesto, se utiliza el 28 de febrero.
   */
  private sumarAnios(
    fecha: Date,
    cantidadAnios: number,
  ): Date {
    const anioDestino =
      fecha.getUTCFullYear() +
      cantidadAnios;

    const mes =
      fecha.getUTCMonth() + 1;

    const diaOriginal =
      fecha.getUTCDate();

    const ultimoDiaMes =
      this.obtenerUltimoDiaMes(
        anioDestino,
        mes,
      );

    const diaAjustado = Math.min(
      diaOriginal,
      ultimoDiaMes,
    );

    return this.crearFechaCalendario(
      anioDestino,
      mes,
      diaAjustado,
    );
  }

  private async obtenerEmpleados(
    nomina: Nomina,
    fechaCorte: Date,
  ): Promise<Empleado[]> {
    const motivo =
      nomina.motivoVacaciones ??
      MotivoVacaciones.PERIODO_NORMAL;

    /*
     * Por terminación solo se procesa al empleado indicado
     * específicamente en la nómina.
     */
    if (
      motivo ===
      MotivoVacaciones.TERMINACION_CONTRATO
    ) {
      if (
        !nomina.empleadoTerminacionId
      ) {
        throw new ConflictException(
          'La nómina de vacaciones por terminación no tiene un empleadoTerminacionId.',
        );
      }

      const empleado =
        await this.empleadoRepository.findOneBy({
          id: nomina.empleadoTerminacionId,
        });

      if (!empleado) {
        throw new NotFoundException(
          `Empleado con ID "${nomina.empleadoTerminacionId}" no encontrado.`,
        );
      }

      const fechaIngreso =
        this.convertirFechaCalendario(
          empleado.fechaIngreso as
            | Date
            | string,
        );

      if (
        fechaIngreso.getTime() >
        fechaCorte.getTime()
      ) {
        throw new ConflictException(
          `El empleado "${empleado.nombre}" no puede recibir vacaciones en ${nomina.periodo} porque su fecha de ingreso es posterior a la fecha de pago.`,
        );
      }

      return [empleado];
    }

    /*
     * Para período normal y vacaciones colectivas se evalúa
     * automáticamente a todos los empleados existentes en la
     * fecha de corte.
     */
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
      fechaCorte.getUTCFullYear() -
      fechaIngreso.getUTCFullYear();

    const aniversario =
      this.sumarAnios(
        fechaIngreso,
        anios,
      );

    if (
      fechaCorte.getTime() <
      aniversario.getTime()
    ) {
      anios -= 1;
    }

    return Math.max(
      anios,
      0,
    );
  }

  private calcularDiasEntre(
    fechaInicio: Date,
    fechaFin: Date,
  ): number {
    if (
      fechaInicio.getTime() >
      fechaFin.getTime()
    ) {
      return 0;
    }

    const diferencia =
      fechaFin.getTime() -
      fechaInicio.getTime();

    return (
      Math.floor(
        diferencia /
          this.milisegundosPorDia,
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
   * Devuelve el último ciclo normal de vacaciones
   * pagado al empleado.
   */
  private async obtenerUltimoCicloPagado(
    empleadoId: number,
  ): Promise<number> {
    const resultado =
      await this.detalleNominaRepository
        .createQueryBuilder(
          'detalle',
        )
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
            tipo:
              TipoNomina.ESPECIAL,
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
   * Verifica que un ciclo normal específico no haya
   * sido pagado previamente.
   */
  private async cicloVacacionesYaPagado(
    empleadoId: number,
    cicloVacaciones: number,
  ): Promise<boolean> {
    const cantidad =
      await this.detalleNominaRepository
        .createQueryBuilder(
          'detalle',
        )
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
            tipo:
              TipoNomina.ESPECIAL,
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
   * Control de repetición de vacaciones colectivas.
   *
   * Un empleado no puede recibir dos pagos colectivos
   * dentro del mismo año calendario.
   *
   * Ejemplo:
   * - Pago colectivo: 2026-08-15
   * - Nuevo intento: 2026-12-10
   *
   * Ambos pertenecen al año 2026, por lo que el segundo
   * pago se considera duplicado.
   */
  private async yaRecibioVacacionesColectivasEnAnio(
    empleadoId: number,
    anio: number,
  ): Promise<boolean> {
    const patronPeriodo =
      `${anio}-%`;

    const cantidad =
      await this.detalleNominaRepository
        .createQueryBuilder(
          'detalle',
        )
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
            tipo:
              TipoNomina.ESPECIAL,
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
              MotivoVacaciones.VACACION_COLECTIVA,
          },
        )
        .andWhere(
          'nomina.periodo LIKE :patronPeriodo',
          {
            patronPeriodo,
          },
        )
        .getCount();

    return cantidad > 0;
  }

  /**
   * Una terminación laboral solo puede generar un pago
   * de vacaciones por empleado.
   */
  private async yaRecibioVacacionesPorTerminacion(
    empleadoId: number,
  ): Promise<boolean> {
    const cantidad =
      await this.detalleNominaRepository
        .createQueryBuilder(
          'detalle',
        )
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
            tipo:
              TipoNomina.ESPECIAL,
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
              MotivoVacaciones.TERMINACION_CONTRATO,
          },
        )
        .getCount();

    return cantidad > 0;
  }

  private async calcularMontoVacaciones(
    nomina: Nomina,
    empleado: Empleado,
    fechaCorte: Date,
  ): Promise<ResultadoVacaciones | null> {
    const fechaIngreso =
      this.convertirFechaCalendario(
        empleado.fechaIngreso as
          | Date
          | string,
      );

    const motivo =
      nomina.motivoVacaciones ??
      MotivoVacaciones.PERIODO_NORMAL;

    let diasPagados = 0;
    let esProporcional = false;
    let cicloVacaciones:
      | number
      | null = null;

    /*
     * VACACIONES NORMALES
     *
     * Se paga el siguiente ciclo laboral que todavía
     * no haya sido pagado y que ya se encuentre completo.
     */
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

      if (
        fechaCorte.getTime() <
        fechaFinCiclo.getTime()
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

    /*
     * VACACIONES COLECTIVAS
     *
     * Se impide que el empleado reciba más de un pago
     * colectivo dentro del mismo año calendario.
     */
    if (
      motivo ===
      MotivoVacaciones.VACACION_COLECTIVA
    ) {
      const anioPago =
        this.obtenerAnioPeriodoEspecial(
          nomina.periodo,
        );

      const yaRecibioEnAnio =
        await this.yaRecibioVacacionesColectivasEnAnio(
          empleado.id,
          anioPago,
        );

      /*
       * Se omite al empleado duplicado sin cancelar el
       * cálculo colectivo para el resto del personal.
       */
      if (yaRecibioEnAnio) {
        return null;
      }

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

      if (
        aniosServicio >= 1
      ) {
        diasPagados = 15;
      } else {
        diasPagados =
          15 *
          Math.min(
            diasTrabajadosCiclo /
              365,
            1,
          );

        esProporcional = true;
      }
    }

    /*
     * TERMINACIÓN DE CONTRATO
     *
     * Solo se procesa al empleado seleccionado en la nómina
     * y se impide un segundo pago por terminación.
     */
    if (
      motivo ===
      MotivoVacaciones.TERMINACION_CONTRATO
    ) {
      const yaRecibio =
        await this.yaRecibioVacacionesPorTerminacion(
          empleado.id,
        );

      if (yaRecibio) {
        throw new ConflictException(
          `El empleado "${empleado.nombre}" ya recibió un pago de vacaciones por terminación de contrato.`,
        );
      }

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
          diasTrabajadosCiclo /
            365,
          1,
        );

      esProporcional = true;
    }

    if (diasPagados <= 0) {
      return null;
    }

    const salarioDiario =
      Number(
        empleado.salarioBase,
      ) / 30;

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
        nomina,
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

    for (
      const empleado of empleados
    ) {
      const resultadoVacaciones =
        await this.calcularMontoVacaciones(
          nomina,
          empleado,
          fechaCorte,
        );

      /*
       * El empleado se omite cuando:
       *
       * - No tiene un ciclo normal disponible.
       * - No cumple los requisitos.
       * - Ya recibió vacaciones colectivas ese año.
       */
      if (
        resultadoVacaciones ===
        null
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
          empleadoId:
            empleado.id,

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