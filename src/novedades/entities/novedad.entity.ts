import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Empleado } from '../../empleados/entities/empleado.entity';
import { Nomina } from '../../nomina/entities/nomina.entity';
import { TipoNovedad } from '../enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from '../enums/subtipo-hora-extra.enum';

@Entity('novedades')
export class Novedad {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Empleado, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'empleadoId' })
  empleado: Empleado;

  @Column()
  empleadoId: number;

  @ManyToOne(() => Nomina, { eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'nominaId' })
  nomina: Nomina;

  @Column()
  nominaId: number;

  @Column({ type: 'enum', enum: TipoNovedad })
  tipo: TipoNovedad;

  //Guarda la cantidad de horas
  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  horas: number | null;

  // Solo aplica a Horas extra. Distingue diurna/nocturna/día de descanso
  // o asueto porque cada una tiene un recargo legal distinto
  @Column({ type: 'enum', enum: SubtipoHoraExtra, nullable: true })
  subtipoHoraExtra: SubtipoHoraExtra | null;

  // Aplica a bonificación y descuento
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  monto: number | null;

  // Fecha de devengo de la novedad, no la fecha de registro en el sistema
  @Column({ type: 'date' })
  fecha: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion: string | null;

  // Distingue una bonificación habitual o recurrente
  @Column({ type: 'boolean', default: false })
  afectaBasePrestaciones: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
