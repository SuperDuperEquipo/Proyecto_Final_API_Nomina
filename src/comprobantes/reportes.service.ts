import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
} from 'typeorm';
import { DetalleNomina } from '../nomina/entities/detalle-nomina.entity';
import { Nomina } from '../nomina/entities/nomina.entity';
import { TipoNomina } from '../nomina/enums/tipo-nomina.enum';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';
import { redondearComercial } from '../common/utils/redondeo.util';

interface AgregadoArea {
  totalDevengado: number;
  totalDeducciones: number;
  liquidoAPagar: number;
  cantidadEmpleados: number;
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Nomina)
    private readonly nominaRepository: Repository<Nomina>,

    @InjectRepository(DetalleNomina)
    private readonly detalleNominaRepository: Repository<DetalleNomina>,
  ) {}

  private async obtenerNominaRegularProcesada(
    periodo: string,
  ): Promise<Nomina> {
    const nomina =
      await this.nominaRepository.findOne({
        where: {
          periodo,
          tipo: TipoNomina.REGULAR,
          estado: In([
            EstadoNomina.CERRADA,
            EstadoNomina.APROBADA,
          ]),
        },
        order: {
          id: 'DESC',
        },
      });

    if (!nomina) {
      throw new NotFoundException(
        `No existe una nómina REGULAR cerrada o aprobada para el período "${periodo}".`,
      );
    }

    return nomina;
  }

  private async agregarPorArea(
    nominaId: number,
  ): Promise<
    Map<string, AgregadoArea>
  > {
    const detalles =
      await this.detalleNominaRepository.find({
        where: {
          nominaId,
        },
        relations: {
          empleado: true,
        },
      });

    if (detalles.length === 0) {
      throw new ConflictException(
        `La nómina "${nominaId}" no contiene detalles para generar el reporte.`,
      );
    }

    const mapa =
      new Map<string, AgregadoArea>();

    for (const detalle of detalles) {
      const area =
        detalle.empleado?.area ??
        'Sin área';

      const agregado =
        mapa.get(area) ?? {
          totalDevengado: 0,
          totalDeducciones: 0,
          liquidoAPagar: 0,
          cantidadEmpleados: 0,
        };

      agregado.totalDevengado +=
        Number(
          detalle.totalDevengado,
        );

      agregado.totalDeducciones +=
        Number(
          detalle.totalDeducciones,
        );

      agregado.liquidoAPagar +=
        Number(
          detalle.liquidoAPagar,
        );

      agregado.cantidadEmpleados += 1;

      mapa.set(area, agregado);
    }

    return mapa;
  }

  async compararPeriodos(
    periodoActual: string,
    periodoAnterior: string,
  ) {
    if (
      periodoActual ===
      periodoAnterior
    ) {
      throw new ConflictException(
        'El período actual y el período anterior deben ser diferentes.',
      );
    }

    const nominaActual =
      await this.obtenerNominaRegularProcesada(
        periodoActual,
      );

    const nominaAnterior =
      await this.obtenerNominaRegularProcesada(
        periodoAnterior,
      );

    const [
      datosActuales,
      datosAnteriores,
    ] = await Promise.all([
      this.agregarPorArea(
        nominaActual.id,
      ),
      this.agregarPorArea(
        nominaAnterior.id,
      ),
    ]);

    const areas = new Set([
      ...datosActuales.keys(),
      ...datosAnteriores.keys(),
    ]);

    const valorVacio: AgregadoArea = {
      totalDevengado: 0,
      totalDeducciones: 0,
      liquidoAPagar: 0,
      cantidadEmpleados: 0,
    };

    const comparativoPorArea =
      Array.from(areas)
        .sort()
        .map((area) => {
          const actual =
            datosActuales.get(area) ??
            valorVacio;

          const anterior =
            datosAnteriores.get(area) ??
            valorVacio;

          const variacionDevengado =
            redondearComercial(
              actual.totalDevengado -
                anterior.totalDevengado,
            );

          const variacionDeducciones =
            redondearComercial(
              actual.totalDeducciones -
                anterior.totalDeducciones,
            );

          const variacionLiquido =
            redondearComercial(
              actual.liquidoAPagar -
                anterior.liquidoAPagar,
            );

          const variacionPorcentual =
            anterior.liquidoAPagar !== 0
              ? redondearComercial(
                  (variacionLiquido /
                    anterior.liquidoAPagar) *
                    100,
                )
              : null;

          return {
            area,
            periodoActual: {
              totalDevengado:
                redondearComercial(
                  actual.totalDevengado,
                ),
              totalDeducciones:
                redondearComercial(
                  actual.totalDeducciones,
                ),
              liquidoAPagar:
                redondearComercial(
                  actual.liquidoAPagar,
                ),
              cantidadEmpleados:
                actual.cantidadEmpleados,
            },
            periodoAnterior: {
              totalDevengado:
                redondearComercial(
                  anterior.totalDevengado,
                ),
              totalDeducciones:
                redondearComercial(
                  anterior.totalDeducciones,
                ),
              liquidoAPagar:
                redondearComercial(
                  anterior.liquidoAPagar,
                ),
              cantidadEmpleados:
                anterior.cantidadEmpleados,
            },
            variaciones: {
              totalDevengado:
                variacionDevengado,
              totalDeducciones:
                variacionDeducciones,
              liquidoAPagar:
                variacionLiquido,
              porcentajeLiquido:
                variacionPorcentual,
            },
          };
        });

    return {
      periodoActual: {
        periodo:
          nominaActual.periodo,
        nominaId:
          nominaActual.id,
      },
      periodoAnterior: {
        periodo:
          nominaAnterior.periodo,
        nominaId:
          nominaAnterior.id,
      },
      comparativoPorArea,
    };
  }
}