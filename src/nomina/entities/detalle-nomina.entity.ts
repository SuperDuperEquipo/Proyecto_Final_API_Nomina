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

@Entity('detalles_nomina')
export class DetalleNomina {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Nomina, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'nominaId',
  })
  nomina!: Nomina;

  @Column()
  nominaId!: number;

  @ManyToOne(() => Empleado, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'empleadoId',
  })
  empleado!: Empleado;

  @Column()
  empleadoId!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  salarioBase!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoHorasExtra!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoBonificaciones!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
    default: 0,
  })
  montoPrestacion!: number;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 4,
    transformer: decimalTransformer,
    nullable: true,
  })
  diasPrestacion!: number | null;

  @Column({
    type: 'boolean',
    default: false,
  })
  prestacionProporcional!: boolean;

  /**
   * Número del ciclo laboral de vacaciones pagado.
   *
   * Ejemplo:
   * 1 = primer año completo desde la fecha de ingreso.
   * 2 = segundo año completo desde la fecha de ingreso.
   * 3 = tercer año completo desde la fecha de ingreso.
   *
   * Solo se utiliza para vacaciones normales completas.
   * En nóminas regulares, aguinaldo y vacaciones proporcionales
   * permanece en null.
   */
  @Column({
    type: 'integer',
    nullable: true,
  })
  cicloVacaciones!: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  montoDescuentos!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalDevengado!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseIsss!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseAfp!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  baseIsrGravable!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  issssTrabajador!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  issssPatronal!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  afpTrabajador!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  afpPatronal!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  isr!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalDeducciones!: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  liquidoAPagar!: number;

  @CreateDateColumn()
  createdAt!: Date;
}