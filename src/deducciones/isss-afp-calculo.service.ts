import { Injectable } from '@nestjs/common';
import { ConfiguracionDeduccion } from './entities/configuracion-deduccion.entity';
import { redondearComercial } from '../common/utils/redondeo.util';

export interface ResultadoIsssAfp {
  issssTrabajador: number;
  issssPatronal: number;
  afpTrabajador: number;
  afpPatronal: number;
}

// Recibe dos bases ya armadas, porque ISSS y AFP no siempre se calculan sobre el mismo monto
@Injectable()
export class IsssAfpCalculoService {
  calcular(baseISSS: number, baseAFP: number, config: ConfiguracionDeduccion): ResultadoIsssAfp {
    const baseISSSTopada = Math.min(baseISSS, config.issssTopeBase);
    const baseAFPTopada = config.afpTopeBase !== null ? Math.min(baseAFP, config.afpTopeBase) : baseAFP;

    return {
      issssTrabajador: redondearComercial(baseISSSTopada * (config.issssPctTrabajador / 100)),
      issssPatronal: redondearComercial(baseISSSTopada * (config.issssPctPatronal / 100)),
      afpTrabajador: redondearComercial(baseAFPTopada * (config.afpPctTrabajador / 100)),
      afpPatronal: redondearComercial(baseAFPTopada * (config.afpPctPatronal / 100)),
    };
  }
}
