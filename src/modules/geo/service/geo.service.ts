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
  // listLgas(opts: { stateId?: string; q?: string } = {}) {
  //   const where: Record<string, unknown> = {};
  //   if (opts.stateId) where.stateId = opts.stateId;
  //   if (opts.q) where.name = ILike(`%${opts.q}%`);
  //   return this.lgaRepo.find({
  //     where,
  //     order: { name: 'ASC' },
  //     take: opts.q ? 50 : undefined,
  //   });
  // }


  // geo.service.ts
async listLgas(opts: { stateId?: string; q?: string } = {}) {
  const qb = this.lgaRepo
    .createQueryBuilder('l')
    .innerJoinAndSelect('l.state', 's')
    .orderBy('l.name', 'ASC');

  if (opts.stateId) qb.andWhere('l.stateId = :stateId', { stateId: opts.stateId });
  if (opts.q) qb.andWhere('l.name ILIKE :q', { q: `%${opts.q}%` }).take(50);

  const rows = await qb.getMany();
  return rows.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
    stateId: l.stateId,
    state: { id: l.state.id, name: l.state.name },
    label: `${l.name}, ${l.state.name}`, // "Garki, Jigawa" vs "Esan West, Edo"
  }));
}
}