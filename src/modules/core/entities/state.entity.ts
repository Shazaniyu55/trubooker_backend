import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Lga } from './lga.entity';

/**
 * A Nigerian state (36 states + the Federal Capital Territory).
 * Seeded by migration CreateStatesAndLgas.
 */
@Entity('states')
export class State extends BaseEntity {
  /** Full state name, e.g. "Lagos", "Federal Capital Territory". */
  @Column({ type: 'varchar', unique: true })
  name: string;

  /** Two-letter abbreviation, e.g. "LA", "FC". */
  @Column({ type: 'varchar', unique: true })
  code: string;

  /** State capital, e.g. "Ikeja" for Lagos. */
  @Column({ type: 'varchar' })
  capital: string;

  /** One of the six geopolitical zones, e.g. "South West". */
  @Column({ type: 'varchar' })
  geopoliticalZone: string;

  /** URL-friendly slug, e.g. "lagos", "federal-capital-territory". */
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @OneToMany(() => Lga, (lga) => lga.state)
  lgas: Lga[];
}