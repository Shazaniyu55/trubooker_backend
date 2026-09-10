import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { State } from './state.entity';

/**
 * A Local Government Area — Nigeria's official administrative "district".
 * There are 774 LGAs across the 36 states + FCT. Seeded by migration
 * CreateStatesAndLgas from the INEC (Independent National Electoral
 * Commission) list.
 */
@Entity('lgas')
@Unique('UQ_lgas_state_name', ['stateId', 'name'])
export class Lga extends BaseEntity {
  /** LGA name, e.g. "Ikeja", "Alimosho". */
  @Column({ type: 'varchar' })
  name: string;

  /** URL-friendly slug, e.g. "ikeja". Unique only within a state. */
  @Column({ type: 'varchar' })
  slug: string;

  /** Official INEC LGA code (two digits, unique within its state). */
  @Column({ type: 'varchar', nullable: true })
  inecCode: string | null;

  @Index('IDX_lgas_stateId')
  @Column({ type: 'uuid' })
  stateId: string;

  @ManyToOne(() => State, (state) => state.lgas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stateId' })
  state: State;
}