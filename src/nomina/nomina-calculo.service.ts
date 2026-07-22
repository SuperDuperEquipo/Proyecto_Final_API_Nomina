import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, LessThanOrEqual, Repository } from 'typeorm';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { HistorialSalario } from '../empleados/entities/historial-salario.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from '../novedades/enums/subtipo-hora-extra.enum';
import { ClasificacionDeduccionesService } from '../deducciones/clasificacion-deducciones.service';
import { ConfiguracionVigenteService } from '../deducciones/configuracion-vigente.service';
import { IsssAfpCalculoService } from '../deducciones/isss-afp-calculo.service';
import { IsrCalculoService } from '../deducciones/isr-calculo.service';
import { redondearComercial } from '../common/utils/redondeo.util';

// Recargo sobre la hora ordinaria por subtipo (ver comentario en el enum
// SubtipoHoraExtra para las citas legales y la nota de verificación).
const MULTIPLICADOR_HORA_EXTRA: Record<SubtipoHoraExtra, number> = {
  [SubtipoHoraExtra.DIURNA]: 2.0,
  [SubtipoHoraExtra.NOCTURNA]: 2.5,
  [SubtipoHoraExtra.DESCANSO_DIURNA]: 4.0,
  [SubtipoHoraExtra.DESCANSO_NOCTURNA]: 4.75,
  [SubtipoHoraExtra.ASUETO_DIURNA]: 5.0,
  [SubtipoHoraExtra.ASUETO_NOCTURNA]: 6.0,
};

interface TramoSalarial {
  desde: Date;
  hasta: Date;
  salario: number;
}

interface RangoPeriodo {
  fechaInicio: Date;
  fechaFin: Date;
}

@Injectable()
export class NominaCalculoService {
  constructor(
    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(HistorialSalario)
    private readonly historialSalarioRepository: Repository<HistorialSalario>,
    @InjectRepository(Novedad)
    private readonly novedadRepository: Repository<Novedad>,
    private readonly clasificacionService: ClasificacionDeduccionesService,
    private readonly configuracionVigenteService: ConfiguracionVigenteService,
    private readonly issssAfpCalculoService: IsssAfpCalculoService,
    private readonly isrCalculoService: IsrCalculoService,
  ) {}

  // periodo: 'AAAA-MM-Q1' | 'AAAA-MM-Q2' (ver CreateNominaDto)
  obtenerRangoPeriodo(periodo: string): RangoPeriodo {
    const match = /^(\d{4})-(\d{2})-Q([12])$/.exec(periodo);
    if (!match) {
      throw new Error(`Formato de período inválido: "${periodo}"`);
    }
    const anio = Number(match[1]);
    const mes = Number(match[2]); // 1-12
    const quincena = match[3];

    if (quincena === '1') {
      return {
        fechaInicio: new Date(anio, mes - 1, 1),
        fechaFin: new Date(anio, mes - 1, 15),
      };
    }
    const ultimoDia = new Date(anio, mes, 0).getDate();
    return {
      fechaInicio: new Date(anio, mes - 1, 16),
      fechaFin: new Date(anio, mes - 1, ultimoDia),
    };
  }

  // Divide el período en tramos por cada cambio de salario registrado en el
  // historial (o por la fecha de ingreso, si el empleado entró a mitad de
  // período). Cada tramo se paga a salario/30 por día.
  private construirTramosSalariales(
    empleado: Empleado,
    historial: HistorialSalario[],
    fechaInicioPeriodo: Date,
    fechaFinPeriodo: Date,
  ): TramoSalarial[] {
    const fechaIngreso = new Date(empleado.fechaIngreso);
    const puntoInicio =
      fechaIngreso > fechaInicioPeriodo ? fechaIngreso : fechaInicioPeriodo;

    if (historial.length === 0) {
      return [
        {
          desde: puntoInicio,
          hasta: fechaFinPeriodo,
          salario: Number(empleado.salarioBase),
        },
      ];
    }

    const tramos: TramoSalarial[] = [];
    let cursor = puntoInicio;
    let salarioVigente = Number(historial[0].salarioAnterior);

    for (const cambio of historial) {
      const fechaCambio = new Date(cambio.fechaCambio);
      if (fechaCambio > cursor) {
        const diaAnterior = new Date(fechaCambio);
        diaAnterior.setDate(diaAnterior.getDate() - 1);
        tramos.push({
          desde: cursor,
          hasta: diaAnterior,
          salario: salarioVigente,
        });
        cursor = fechaCambio;
      }
      salarioVigente = Number(cambio.salarioNuevo);
    }
    tramos.push({
      desde: cursor,
      hasta: fechaFinPeriodo,
      salario: salarioVigente,
    });

    return tramos;
  }

  private salarioVigenteEnFecha(tramos: TramoSalarial[], fecha: Date): number {
    const f = new Date(fecha);
    const tramo = tramos.find((t) => f >= t.desde && f <= t.hasta);
    return tramo ? tramo.salario : tramos[tramos.length - 1].salario;
  }

  private diasEnTramo(tramo: TramoSalarial): number {
    return (
      Math.round((tramo.hasta.getTime() - tramo.desde.getTime()) / 86400000) + 1
    );
  }

  // Calcula y persiste el desglose de todos los empleados vigentes para una
  // nómina REGULAR. Borra cualquier detalle previo del mismo nominaId primero,
  // así que reintentar tras un reabrir() no deja filas duplicadas ni huérfanas.
  async calcularPeriodoRegular(nomina: Nomina): Promise<DetalleNomina[]> {
    const { fechaInicio, fechaFin } = this.obtenerRangoPeriodo(nomina.periodo);

    await this.detalleNominaRepository.delete({ nominaId: nomina.id });

    const empleados = await this.empleadoRepository.find({
      where: { fechaIngreso: LessThanOrEqual(fechaFin) },
    });

    if (empleados.length === 0) {
      return [];
    }

    // Config y tramos ISR vigentes se buscan una sola vez: son los mismos
    // para todos los empleados de este período.
    const config =
      await this.configuracionVigenteService.obtenerConfiguracionVigente(
        fechaFin,
      );
    const tramosIsr =
      await this.configuracionVigenteService.obtenerTramosIsrVigentes(fechaFin);

    const finDeDiaPeriodo = new Date(fechaFin);
    finDeDiaPeriodo.setHours(23, 59, 59, 999);

    const detalles: DetalleNomina[] = [];

    for (const empleado of empleados) {
      const historial = await this.historialSalarioRepository.find({
        where: {
          empleadoId: empleado.id,
          fechaCambio: Between(fechaInicio, finDeDiaPeriodo),
        },
        order: { fechaCambio: 'ASC' },
      });

      const tramos = this.construirTramosSalariales(
        empleado,
        historial,
        fechaInicio,
        fechaFin,
      );
      const devengadoOrdinarioBruto = redondearComercial(
        tramos.reduce(
          (acc, t) => acc + this.diasEnTramo(t) * (t.salario / 30),
          0,
        ),
      );

      const novedades = await this.novedadRepository.find({
        where: { empleadoId: empleado.id, nominaId: nomina.id },
      });

      let descuentoPermisos = 0;
      let montoHorasExtra = 0;
      let montoBonificaciones = 0;
      let montoDescuentos = 0;
      let extraIsss = 0;
      let extraAfp = 0;
      let extraIsr = 0;

      for (const novedad of novedades) {
        if (novedad.tipo === TipoNovedad.PERMISO_SIN_GOCE) {
          const salarioDelDia = this.salarioVigenteEnFecha(
            tramos,
            novedad.fecha,
          );
          descuentoPermisos += redondearComercial(salarioDelDia / 30);
          continue;
        }

        if (novedad.tipo === TipoNovedad.HORAS_EXTRA) {
          const salarioDelDia = this.salarioVigenteEnFecha(
            tramos,
            novedad.fecha,
          );
          const tarifaHora = salarioDelDia / 240;
          const multiplicador =
            MULTIPLICADOR_HORA_EXTRA[
              novedad.subtipoHoraExtra as SubtipoHoraExtra
            ];
          const monto = redondearComercial(
            Number(novedad.horas ?? 0) * tarifaHora * multiplicador,
          );
          montoHorasExtra += monto;

          const clasif = this.clasificacionService.clasificar(
            TipoNovedad.HORAS_EXTRA,
            null,
          );
          if (clasif.cuentaISSS) extraIsss += monto;
          if (clasif.cuentaAFP) extraAfp += monto;
          if (clasif.cuentaISR) extraIsr += monto;
          continue;
        }

        if (novedad.tipo === TipoNovedad.BONIFICACION) {
          const monto = Number(novedad.monto ?? 0);
          montoBonificaciones += monto;

          const clasif = this.clasificacionService.clasificar(
            TipoNovedad.BONIFICACION,
            novedad.afectaBasePrestaciones,
          );
          if (clasif.cuentaISSS) extraIsss += monto;
          if (clasif.cuentaAFP) extraAfp += monto;
          if (clasif.cuentaISR) extraIsr += monto;
          continue;
        }

        if (novedad.tipo === TipoNovedad.DESCUENTO) {
          montoDescuentos += Number(novedad.monto ?? 0);
          continue;
        }

        // LICENCIA_MATERNIDAD: el modelo actual de Novedad no captura un monto
        // de subsidio para este tipo (ver limitación documentada en el README
        // de nomina). Su salario ordinario ya cuenta normalmente porque, a
        // diferencia de PERMISO_SIN_GOCE, nada lo resta del devengado.
      }

      const salarioBaseNeto = redondearComercial(
        devengadoOrdinarioBruto - descuentoPermisos,
      );
      const totalDevengado = redondearComercial(
        salarioBaseNeto + montoHorasExtra + montoBonificaciones,
      );
      const baseIsss = redondearComercial(salarioBaseNeto + extraIsss);
      const baseAfp = redondearComercial(salarioBaseNeto + extraAfp);
      const baseIsrBruta = redondearComercial(salarioBaseNeto + extraIsr);

      const resultadoIsssAfp = this.issssAfpCalculoService.calcular(
        baseIsss,
        baseAfp,
        config,
      );

      // Base gravable de ISR = salario bruto - ISSS trabajador - AFP trabajador
      const baseIsrGravable = redondearComercial(
        baseIsrBruta -
          resultadoIsssAfp.issssTrabajador -
          resultadoIsssAfp.afpTrabajador,
      );
      const isr = this.isrCalculoService.calcular(baseIsrGravable, tramosIsr);

      const totalDeducciones = redondearComercial(
        resultadoIsssAfp.issssTrabajador +
          resultadoIsssAfp.afpTrabajador +
          isr +
          montoDescuentos,
      );
      const liquidoAPagar = redondearComercial(
        totalDevengado - totalDeducciones,
      );

      const detalle = this.detalleNominaRepository.create({
        nominaId: nomina.id,
        empleadoId: empleado.id,
        salarioBase: salarioBaseNeto,
        montoHorasExtra,
        montoBonificaciones,
        montoPrestacion: 0,
        diasPrestacion: null,
        prestacionProporcional: false,
        montoDescuentos,
        totalDevengado,
        baseIsss,
        baseAfp,
        baseIsrGravable,
        issssTrabajador: resultadoIsssAfp.issssTrabajador,
        issssPatronal: resultadoIsssAfp.issssPatronal,
        afpTrabajador: resultadoIsssAfp.afpTrabajador,
        afpPatronal: resultadoIsssAfp.afpPatronal,
        isr,
        totalDeducciones,
        liquidoAPagar,
      });

      detalles.push(await this.detalleNominaRepository.save(detalle));
    }

    return detalles;
  }
}
