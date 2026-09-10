import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { State } from '@modules/core/entities/state.entity';
import { Lga } from '@modules/core/entities/lga.entity';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(State) private readonly stateRepo: Repository<State>,
    @InjectRepository(Lga) private readonly lgaRepo: Repository<Lga>,
  ) {}

  /** All states (36 + FCT). Optional name search, zone filter, and LGA inclusion. */
  listStates(opts: { q?: string; zone?: string; withLgas?: boolean } = {}) {
    const qb = this.stateRepo.createQueryBuilder('s');
    if (opts.q) qb.andWhere('s.name ILIKE :q', { q: `%${opts.q}%` });
    if (opts.zone) qb.andWhere('s.geopoliticalZone ILIKE :zone', { zone: opts.zone });
    qb.orderBy('s.name', 'ASC');
    if (opts.withLgas) {
      qb.leftJoinAndSelect('s.lgas', 'l').addOrderBy('l.name', 'ASC');
    }
    return qb.getMany();
  }

  /** One state with its LGAs, looked up by UUID or slug. */
  async getStateWithLgas(idOrSlug: string) {
    const qb = this.stateRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.lgas', 'l')
      .addOrderBy('l.name', 'ASC');

    if (UUID_RE.test(idOrSlug)) qb.where('s.id = :v', { v: idOrSlug });
    else qb.where('s.slug = :v', { v: idOrSlug.toLowerCase() });

    const state = await qb.getOne();
    if (!state) throw new NotFoundException('State not found');
    return state;
  }

  /** LGAs belonging to a state (by state UUID or slug). */
  async listLgasForState(idOrSlug: string) {
    const state = await this.getStateWithLgas(idOrSlug);
    return state.lgas;
  }

  /** Search/list LGAs, optionally scoped to a state. Name searches are capped at 50 rows. */
  listLgas(opts: { stateId?: string; q?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (opts.stateId) where.stateId = opts.stateId;
    if (opts.q) where.name = ILike(`%${opts.q}%`);
    return this.lgaRepo.find({
      where,
      order: { name: 'ASC' },
      take: opts.q ? 50 : undefined,
    });
  }
}