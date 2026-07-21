import { Injectable } from '@nestjs/common';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';

// PERMISO_SIN_GOCE y DESCUENTO no se clasifican aquí: no son un monto que se suma a una base, se manejan
// aparte
export interface ClasificacionBaseDeduccion {
  cuentaISSS: boolean;
  cuentaAFP: boolean;
  cuentaISR: boolean;

  topeIndividualAFP?: number;
}

@Injectable()
export class ClasificacionDeduccionesService {
  // afectaBasePrestaciones solo aplica a BONIFICACION (habitual vs. ocasional)
  clasificar(tipo: TipoNovedad, afectaBasePrestaciones: boolean | null): ClasificacionBaseDeduccion {
    switch (tipo) {
      case TipoNovedad.HORAS_EXTRA:
        return { cuentaISSS: false, cuentaAFP: true, cuentaISR: true };

      case TipoNovedad.BONIFICACION:
        return afectaBasePrestaciones
          ? { cuentaISSS: true, cuentaAFP: true, cuentaISR: true }
          : { cuentaISSS: false, cuentaAFP: false, cuentaISR: true };

      case TipoNovedad.LICENCIA_MATERNIDAD:
        return { cuentaISSS: true, cuentaAFP: true, cuentaISR: true, topeIndividualAFP: 1000 };

      default:
        throw new Error(
          `clasificar() no aplica a ${tipo}: PERMISO_SIN_GOCE y DESCUENTO se manejan aparte.`,
        );
    }
  }
}
