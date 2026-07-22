import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Nomina } from './nomina.entity';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';

// Una fila por empleado por nómina REGULAR cerrada: es el desglose que hace
// concreto el argumento de inmutabilidad de APROBADA (Art. 53.I CT) — sin
// persistir este resultado no hay nada que proteger de una reducción retroactiva.
@Entity('detalles_nomina')
export class DetalleNomina {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Nomina, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nominaId' })
  nomina: Nomina;

  @Column()
  nominaId: number;

  @ManyToOne(() => Empleado, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'empleadoId' })
  empleado: Empleado;

  @Column()
  empleadoId: number;

  // Devengado ordinario ya prorrateado (cambios de salario a mitad de
  // período) y ya neto de días de PERMISO_SIN_GOCE.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  salarioBase: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoHorasExtra: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoBonificaciones: number;

  // DESCUENTO: se resta del líquido, nunca de las bases de ISSS/AFP/ISR.
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoDescuentos: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalDevengado: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseIsss: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseAfp: number;

  // Base gravable de ISR = base ISR bruta - ISSS trabajador - AFP trabajador
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseIsrGravable: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  issssTrabajador: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  issssPatronal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  afpTrabajador: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  afpPatronal: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  isr: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalDeducciones: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  liquidoAPagar: number;

  @CreateDateColumn()
  createdAt: Date;
}
