import { Injectable } from '@nestjs/common';
import { ClasificacionDeduccionesService } from './clasificacion-deducciones.service';
import { ConfiguracionVigenteService } from './configuracion-vigente.service';
import { IsssAfpCalculoService } from './isss-afp-calculo.service';
import { IsrCalculoService } from './isr-calculo.service';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';
import { SimularDeduccionesDto } from './dto/simular-deducciones.dto';
import { redondearComercial } from '../common/utils/redondeo.util';

export interface ResultadoSimulacion {
  salarioBase: number;
  bonificacion: { monto: number; habitual: boolean } | null;
  baseISSS: number;
  baseAFP: number;
  issssTrabajador: number;
  issssPatronal: number;
  afpTrabajador: number;
  afpPatronal: number;
  baseGravableISR: number;
  isr: number;
  salarioNeto: number;
}

@Injectable()
export class SimulacionDeduccionesService {
  constructor(
    private readonly clasificacion: ClasificacionDeduccionesService,
    private readonly configVigente: ConfiguracionVigenteService,
    private readonly isssAfpCalculo: IsssAfpCalculoService,
    private readonly isrCalculo: IsrCalculoService,
  ) {}

  async simular(dto: SimularDeduccionesDto): Promise<ResultadoSimulacion> {
    const fecha = new Date(dto.fecha);
    const config = await this.configVigente.obtenerConfiguracionVigente(fecha);
    const tramos = await this.configVigente.obtenerTramosIsrVigentes(fecha);

    let baseISSS = dto.salarioBase;
    let baseAFP = dto.salarioBase;
    let montoQueAplicaISR = dto.salarioBase;

    if (dto.bonificacion) {
      const clasif = this.clasificacion.clasificar(TipoNovedad.BONIFICACION, dto.bonificacion.habitual);
      if (clasif.cuentaISSS) baseISSS += dto.bonificacion.monto;
      if (clasif.cuentaAFP) baseAFP += dto.bonificacion.monto;
      if (clasif.cuentaISR) montoQueAplicaISR += dto.bonificacion.monto;
    }

    const { issssTrabajador, issssPatronal, afpTrabajador, afpPatronal } = this.isssAfpCalculo.calcular(
      baseISSS,
      baseAFP,
      config,
    );

    const baseGravableISR = montoQueAplicaISR - issssTrabajador - afpTrabajador;
    const isr = this.isrCalculo.calcular(baseGravableISR, tramos);
    const salarioNeto = redondearComercial(montoQueAplicaISR - issssTrabajador - afpTrabajador - isr);

    return {
      salarioBase: dto.salarioBase,
      bonificacion: dto.bonificacion ?? null,
      baseISSS,
      baseAFP,
      issssTrabajador,
      issssPatronal,
      afpTrabajador,
      afpPatronal,
      baseGravableISR,
      isr,
      salarioNeto,
    };
  }
}
