import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { EstadoNomina } from '../enums/estado-nomina.enum';
import { TipoNomina } from '../enums/tipo-nomina.enum';

//Entidad mínima de Nómina, P4 luego la expande
@Entity('nominas')
export class Nomina {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  periodo: string;

  @Column({
    type: 'enum',
    enum: TipoNomina,
    default: TipoNomina.REGULAR,
  })
  tipo: TipoNomina;

  @Column({
    type: 'enum',
    enum: EstadoNomina,
    default: EstadoNomina.ABIERTA,
  })
  estado: EstadoNomina;

  @Column({ type: 'date', nullable: true })
  fechaAprobacion: Date | null;
}
