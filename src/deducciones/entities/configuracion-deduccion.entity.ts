import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { decimalTransformer } from '../../common/transformers/decimal.transformer';


// Configuración versionada de deducciones legales
@Entity('configuracion_deduccion')
export class ConfiguracionDeduccion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  vigenteDesde: Date;

  @Column({ type: 'date', nullable: true })
  vigenteHasta: Date | null;

  // ISSS
  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  issssPctTrabajador: number; // 3.00

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  issssPctPatronal: number; // 7.50

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: decimalTransformer })
  issssTopeBase: number; // 1000.00, tope de trabajador $30 y patrono $75

  // AFP
  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  afpPctTrabajador: number; // 7.25

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: decimalTransformer })
  afpPctPatronal: number; // 8.75

  // null = sin tope de cotización
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  afpTopeBase: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
