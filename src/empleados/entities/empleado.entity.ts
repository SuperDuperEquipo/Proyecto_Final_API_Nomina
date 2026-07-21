import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { TipoDocumento } from './tipo-documento.enum';
import { SectorEconomico } from './sector-economico.enum';

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

  @Column({
    type: 'enum',
    enum: TipoDocumento,
    default: TipoDocumento.DUI,
  })
  tipoDocumento: TipoDocumento;

  @Column({ type: 'varchar', length: 50, unique: true })
  documentoIdentidad: string;

  @Column({ type: 'varchar', length: 150, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password?: string;

  @Column({
    type: 'enum',
    enum: SectorEconomico,
    default: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
  })
  sectorEconomico: SectorEconomico;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  salarioBase: number;

  @Column({ type: 'varchar', length: 100 })
  cargo: string;

  @Column({ type: 'varchar', length: 100 })
  area: string;

  @Column({ type: 'date' })
  fechaIngreso: Date;

  @Column({ type: 'varchar', length: 100, nullable: true })
  afp?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  isss?: string;

  @CreateDateColumn({ type: 'timestamp' })
  fechaRegistro: Date;

  // Propiedad virtual para control administrativo de plazos (no se guarda en BD)
  alertaDocumentacionVencida?: boolean;

  @Column({
    type: 'enum',
    enum: EmpleadoRole,
    default: EmpleadoRole.EMPLEADO,
  })
  rol: EmpleadoRole;
}
