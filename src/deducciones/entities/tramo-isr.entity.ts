import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';

// Tramo de ISR versionado por fecha
@Entity('tramo_isr')
export class TramoISR {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  vigenteDesde: Date;

  //null = vigencia actual, no reemplazada por nuevo decreto
  @Column({ type: 'date', nullable: true })
  vigenteHasta: Date | null;

  // Orden del tramo dentro de esta vigencia: 1 (exento) a 4 (más alto)
  @Column({ type: 'int' })
  numeroTramo: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  limiteInferior: number;

  // null = "en adelante" (el tramo más alto no tiene límite superior)
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: decimalTransformer,
  })
  limiteSuperior: number | null;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    transformer: decimalTransformer,
  })
  porcentaje: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  cuotaFija: number;

  @CreateDateColumn()
  createdAt: Date;
}
