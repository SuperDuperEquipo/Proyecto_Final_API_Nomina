import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Empleado } from './empleado.entity';

@Entity('historial_salarios')
export class HistorialSalario {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Empleado, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empleadoId' })
  empleado: Empleado;

  @Column({ name: 'empleadoId' })
  empleadoId: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salarioAnterior: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salarioNuevo: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fechaCambio: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo?: string;
}
