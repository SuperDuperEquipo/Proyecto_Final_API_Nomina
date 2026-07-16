import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum EmpleadoRole {
  ADMIN = 'ADMIN',
  RECURSOS_HUMANOS = 'RECURSOS_HUMANOS',
  EMPLEADO = 'EMPLEADO',
}

@Entity('empleados')
export class Empleado {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 150 })
  nombre: string;

  @Column({ type: 'varchar', length: 10, unique: true })
  dui: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salarioBase: number;

  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @Column({ type: 'varchar', length: 100 })
  area: string;

  @Column({ type: 'date' })
  fechaIngreso: Date;

  @Column({ type: 'varchar', length: 100 })
  afp: string;

  @Column({
    type: 'enum',
    enum: EmpleadoRole,
    default: EmpleadoRole.EMPLEADO,
  })
  rol: EmpleadoRole;
}
