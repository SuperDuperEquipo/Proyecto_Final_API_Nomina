import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { EstadoNomina } from '../enums/estado-nomina.enum';
import { TipoNomina } from '../enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../enums/subtipo-nomina-especial.enum';

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

  // Solo aplica cuando tipo = ESPECIAL: distingue Quincena 25 de Aguinaldo,
  // porque cada una tiene reglas de elegibilidad y exención distintas
  @Column({
    type: 'enum',
    enum: SubtipoNominaEspecial,
    nullable: true,
  })
  subtipoEspecial: SubtipoNominaEspecial | null;

  @Column({
    type: 'enum',
    enum: EstadoNomina,
    default: EstadoNomina.ABIERTA,
  })
  estado: EstadoNomina;

  @Column({ type: 'date', nullable: true })
  fechaAprobacion: Date | null;
}
