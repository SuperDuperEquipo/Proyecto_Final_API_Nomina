import { Injectable } from '@nestjs/common';
import { TramoISR } from './entities/tramo-isr.entity';
import { redondearComercial } from '../common/utils/redondeo.util';

// Calcula ISR sobre una base gravable ya calculada
@Injectable()
export class IsrCalculoService {
  calcular(baseGravable: number, tramos: TramoISR[]): number {
    if (baseGravable <= 0) {
      return 0;
    }

    const tramoAplicable = [...tramos]
      .sort((a, b) => a.numeroTramo - b.numeroTramo)
      .find(
        (t) =>
          baseGravable >= t.limiteInferior &&
          (t.limiteSuperior === null || baseGravable <= t.limiteSuperior),
      );

    if (!tramoAplicable) {
      throw new Error(
        `No se encontró un tramo de ISR que cubra la base gravable de $${baseGravable}. ` +
          'Revisar que los tramos configurados para este período cubran desde $0.01 sin huecos.',
      );
    }

    if (tramoAplicable.porcentaje === 0) {
      return 0; // Tramo I: exento
    }

    // La tabla real calcula el excedente contra un centavo menos que
    // limiteInferior (por ejemplo: tramo II, "exceso de $550" y no $550.01).
    const referenciaExcedente = tramoAplicable.limiteInferior - 0.01;
    const excedente = baseGravable - referenciaExcedente;
    const isr = tramoAplicable.cuotaFija + excedente * (tramoAplicable.porcentaje / 100);

    return redondearComercial(isr);
  }
}
