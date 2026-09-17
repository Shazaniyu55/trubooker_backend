// system-setting.service.ts
import { SystemSetting } from '@modules/core/entities/system-setting.entity';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PriceControlDto, ReferralProgramDto, SystemSettingEnum } from 'src/types/enums';
import { Repository } from 'typeorm';
import { RedisCacheService } from '@modules/cache/redis-cache.service';
import { CACHE_TTL } from '@modules/cache/redis-cache.constants';
import { PreferredTimeSlotDto, SetPreferredTimeSlotsDto } from '../dto/timeslot.dto';

/**
 * Must match FareService.DEFAULT_PER_KM_RATE — used only as a display
 * fallback here when nothing has ever been configured.
 */
const DEFAULT_PER_KM_RATE = 200;


@Injectable()
export class SystemSettingService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingRepo: Repository<SystemSetting>,
    private readonly cache: RedisCacheService
  ) {}
  private readonly PRICE_KEY = 'system:price_control';
  private readonly REFERRAL_KEY = 'system:referral_program';
  private readonly TIME_SLOT_KEY = 'preferred_time_slots:cache';

  private readonly DEFAULT_SLOTS: PreferredTimeSlotDto[] = [
  { key: 'morning', label: 'Morning', time: '07:00:00', range: '6:00 AM - 8:00 AM', order: 0 },
  { key: 'afternoon', label: 'Afternoon', time: '12:00:00', range: '12:00 PM - 2:00 PM', order: 1 },
  { key: 'evening', label: 'Evening', time: '17:00:00', range: '5:00 PM - 7:00 PM', order: 2 },
  { key: 'early_afternoon', label: 'Early Afternoon', time: '13:00:00', range: '1:00 PM - 3:00 PM', order: 3 },
];

  // ─── Get All Settings ────────────────────────────────────────────────────────

  async getAllSettings() {
    const settings = await this.settingRepo.find({ order: { createdAt: 'ASC' } });
    return settings.map((s) =>
      s.key === SystemSettingEnum.PRICE_CONTROL
        ? { ...s, value: this.normalizePriceControl(s.value) }
        : s,
    );
  }

  async getSettingByKey(key: SystemSettingEnum) {
    const setting = await this.settingRepo.findOne({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
    return setting;
  }

  // ─── Price Control ───────────────────────────────────────────────────────────

async setPriceControl(data: PriceControlDto) {
  const setting = await this.settingRepo.findOne({
    where: { key: SystemSettingEnum.PRICE_CONTROL },
  });
  if (!setting) throw new NotFoundException('Price control setting not found');

  setting.value = { ...setting.value, ...data };
  const saved = await this.settingRepo.save(setting);
  await this.cache.del(this.PRICE_KEY); // ← invalidate
  return saved;
}

async setPricePerKm(pricePerKm: number) {
 const setting = await this.settingRepo.findOne({
  where: { key: SystemSettingEnum.PRICE_CONTROL },
 });
 if (!setting) throw new NotFoundException('Price control setting not found');
 // `perKmRate` is the field FareService actually reads when calculating
 // fares — write both so the rate takes effect immediately AND the admin
 // sees the value under the name they set it with (`pricePerKm`).
 setting.value = { ...setting.value, perKmRate: pricePerKm, pricePerKm };
 const saved = await this.settingRepo.save(setting);
 await this.cache.del(this.PRICE_KEY);
 return saved;
}

/**
 * Reconciles the two names this rate has been saved under historically.
 * `perKmRate` is canonical (FareService reads it); `pricePerKm` is the name
 * the dedicated admin "set price per km" route used to write exclusively,
 * so older rows may only have that. Always returns both, in sync, so every
 * caller — fare calculation, get-all, get-price-control — agrees.
 */
private normalizePriceControl(
  value: Partial<PriceControlDto> | null | undefined,
): PriceControlDto {
  const v = { ...(value ?? {}) } as PriceControlDto;
  const rate = v.perKmRate ?? v.pricePerKm ?? DEFAULT_PER_KM_RATE;
  v.perKmRate = rate;
  v.pricePerKm = rate;
  return v;
}

/**
 * Set the driver-board dispatch window hours — how far ahead of departure a
 * MATCHING pool is pushed to the board — for intra-state and/or inter-state
 * trips. Either field alone is fine (updates just that one); at least one
 * must be provided. Stored on the same price-control row as everything else
 * price/timing related, so `getPriceControl()` and the fare/matching logic
 * that already reads it keep working unchanged.
 */
async setDispatchWindow(dto: {
  intraStateDispatchWindowHours?: number;
  interStateDispatchWindowHours?: number;
}) {
  if (
    dto.intraStateDispatchWindowHours == null &&
    dto.interStateDispatchWindowHours == null
  ) {
    throw new BadRequestException(
      'Provide intraStateDispatchWindowHours and/or interStateDispatchWindowHours',
    );
  }
  const setting = await this.settingRepo.findOne({
    where: { key: SystemSettingEnum.PRICE_CONTROL },
  });
  if (!setting) throw new NotFoundException('Price control setting not found');
  setting.value = { ...setting.value, ...dto };
  const saved = await this.settingRepo.save(setting);
  await this.cache.del(this.PRICE_KEY);
  return saved;
}

/** Just the two dispatch-window hours, with defaults filled in if unset. */
async getDispatchWindow(): Promise<{
  intraStateDispatchWindowHours: number;
  interStateDispatchWindowHours: number;
}> {
  let settings: Partial<PriceControlDto> = {};
  try {
    settings = (await this.getPriceControl()) ?? {};
  } catch {
    // No price-control row yet — fall back to defaults silently.
  }
  return {
    intraStateDispatchWindowHours: settings.intraStateDispatchWindowHours ?? 12,
    interStateDispatchWindowHours: settings.interStateDispatchWindowHours ?? 18,
  };
}


async getPreferredTimeSlots(): Promise<PreferredTimeSlotDto[]> {
  const cached = await this.cache.get<PreferredTimeSlotDto[]>(this.TIME_SLOT_KEY);
  if (cached) return cached;

  const setting = await this.settingRepo.findOne({
    where: { key: SystemSettingEnum.PREFRERRED_TIME_SLOTS },
  });

  const slots = (setting?.value?.slots as PreferredTimeSlotDto[]) ?? this.DEFAULT_SLOTS;
  await this.cache.set(this.TIME_SLOT_KEY, slots);
  return slots;
}

async setPreferredTimeSlots(dto: SetPreferredTimeSlotsDto) {
  this.assertUniqueKeys(dto.slots);

  let setting = await this.settingRepo.findOne({
    where: { key: SystemSettingEnum.PREFRERRED_TIME_SLOTS },
  });

  if (!setting) {
    setting = this.settingRepo.create({
      key: SystemSettingEnum.PREFRERRED_TIME_SLOTS,
      value: {},
    });
  }

  setting.value = { ...setting.value, slots: dto.slots };
  const saved = await this.settingRepo.save(setting);
  await this.cache.del(this.TIME_SLOT_KEY);
  return saved;
}

async addPreferredTimeSlot(slot: PreferredTimeSlotDto) {
  const slots = await this.getPreferredTimeSlots();
  if (slots.some((s) => s.key === slot.key)) {
    throw new ConflictException(`Slot with key "${slot.key}" already exists`);
  }
  const updated = [...slots, slot].sort((a, b) => a.order - b.order);
  return this.setPreferredTimeSlots({ slots: updated });
}

async updatePreferredTimeSlot(key: string, patch: Partial<Omit<PreferredTimeSlotDto, 'key'>>) {
  const slots = await this.getPreferredTimeSlots();
  const idx = slots.findIndex((s) => s.key === key);
  if (idx === -1) throw new NotFoundException(`Slot "${key}" not found`);
  const updated = [...slots];
  updated[idx] = { ...updated[idx], ...patch };
  return this.setPreferredTimeSlots({ slots: updated });
}

async removePreferredTimeSlot(key: string) {
  const slots = await this.getPreferredTimeSlots();
  const filtered = slots.filter((s) => s.key !== key);
  if (filtered.length === slots.length) throw new NotFoundException(`Slot "${key}" not found`);
  if (filtered.length === 0) throw new BadRequestException('At least one preferred time slot must remain');
  return this.setPreferredTimeSlots({ slots: filtered });
}

async reorderPreferredTimeSlots(orderedKeys: string[]) {
  const slots = await this.getPreferredTimeSlots();
  const valid = orderedKeys.length === slots.length &&
    orderedKeys.every((k) => slots.some((s) => s.key === k));
  if (!valid) throw new BadRequestException('orderedKeys must match existing slot keys exactly');

  const byKey = new Map(slots.map((s) => [s.key, s]));
  const reordered = orderedKeys.map((key, order) => ({ ...byKey.get(key)!, order }));
  return this.setPreferredTimeSlots({ slots: reordered });
}

async getPriceControl(): Promise<PriceControlDto> {
  return this.cache.getOrSet(
    this.PRICE_KEY,
    async () => {
      const setting = await this.settingRepo.findOne({
        where: { key: SystemSettingEnum.PRICE_CONTROL },
      });
      if (!setting) throw new NotFoundException('Price control setting not found');
      return this.normalizePriceControl(setting.value);
    },
    CACHE_TTL.HOUR,
  );
}

  // ─── Referral Program ────────────────────────────────────────────────────────

async setReferralProgram(data: ReferralProgramDto) {
  const setting = await this.settingRepo.findOne({
    where: { key: SystemSettingEnum.REFERRAL_PROGRAM },
  });
  if (!setting) throw new NotFoundException('Referral program setting not found');

  setting.value = { ...setting.value, ...data };
  const saved = await this.settingRepo.save(setting);
  await this.cache.del(this.REFERRAL_KEY); // ← invalidate
  return saved;
}

async getReferralProgram(): Promise<ReferralProgramDto> {
  return this.cache.getOrSet(
    this.REFERRAL_KEY,
    async () => {
      const setting = await this.settingRepo.findOne({
        where: { key: SystemSettingEnum.REFERRAL_PROGRAM },
      });
      if (!setting) throw new NotFoundException('Referral program setting not found');
      return setting.value as ReferralProgramDto;
    },
    CACHE_TTL.HOUR,
  );
}

  // ─── Seed Default Settings (run once on app bootstrap) ───────────────────────

  async seedDefaults() {
    const defaults = [
      {
        key: SystemSettingEnum.PRICE_CONTROL,
        description: 'Controls platform pricing and commission rates',
        value: {
          agentEarningAmount: 50000,
          platformCommissionRate: 10,
          driverEarningRate: 85,
          minTripPrice: 500,
          maxTripPrice: 100000,
          intraStateDispatchWindowHours: 12,
          interStateDispatchWindowHours: 18,
        } as PriceControlDto,
      },
      {
        key: SystemSettingEnum.REFERRAL_PROGRAM,
        description: 'Controls agent referral earning rules',
        value: {
          earningPerTrip: 1000,
          maxEarningPerDriver: 50000,
          referralBonus: 0,
          isActive: true,
        } as ReferralProgramDto,
      },
    ];

    for (const item of defaults) {
      const exists = await this.settingRepo.findOne({ where: { key: item.key } });
      if (!exists) {
        await this.settingRepo.save(this.settingRepo.create(item));
      }
    }
  }


  private assertUniqueKeys(slots: PreferredTimeSlotDto[]) {
  const seen = new Set<string>();
  for (const s of slots) {
    if (seen.has(s.key)) throw new BadRequestException(`Duplicate slot key "${s.key}"`);
    seen.add(s.key);
  }
}
}
// // system-setting.service.ts
// import { SystemSetting } from '@modules/core/entities/system-setting.entity';
// import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
// import { InjectRepository } from '@nestjs/typeorm';
// import { PriceControlDto, ReferralProgramDto, SystemSettingEnum } from 'src/types/enums';
// import { Repository } from 'typeorm';
// import { RedisCacheService } from '@modules/cache/redis-cache.service';
// import { CACHE_TTL } from '@modules/cache/redis-cache.constants';
// import { PreferredTimeSlotDto, SetPreferredTimeSlotsDto } from '../dto/timeslot.dto';


// @Injectable()
// export class SystemSettingService {
//   constructor(
//     @InjectRepository(SystemSetting)
//     private readonly settingRepo: Repository<SystemSetting>,
//     private readonly cache: RedisCacheService
//   ) {}
//   private readonly PRICE_KEY = 'system:price_control';
//   private readonly REFERRAL_KEY = 'system:referral_program';
//   private readonly TIME_SLOT_KEY = 'preferred_time_slots:cache';

//   private readonly DEFAULT_SLOTS: PreferredTimeSlotDto[] = [
//   { key: 'morning', label: 'Morning', time: '07:00:00', range: '6:00 AM - 8:00 AM', order: 0 },
//   { key: 'afternoon', label: 'Afternoon', time: '12:00:00', range: '12:00 PM - 2:00 PM', order: 1 },
//   { key: 'evening', label: 'Evening', time: '17:00:00', range: '5:00 PM - 7:00 PM', order: 2 },
//   { key: 'early_afternoon', label: 'Early Afternoon', time: '13:00:00', range: '1:00 PM - 3:00 PM', order: 3 },
// ];

//   // ─── Get All Settings ────────────────────────────────────────────────────────

//   async getAllSettings() {
//     return this.settingRepo.find({ order: { createdAt: 'ASC' } });
//   }

//   async getSettingByKey(key: SystemSettingEnum) {
//     const setting = await this.settingRepo.findOne({ where: { key } });
//     if (!setting) throw new NotFoundException(`Setting "${key}" not found`);
//     return setting;
//   }

//   // ─── Price Control ───────────────────────────────────────────────────────────

// async setPriceControl(data: PriceControlDto) {
//   const setting = await this.settingRepo.findOne({
//     where: { key: SystemSettingEnum.PRICE_CONTROL },
//   });
//   if (!setting) throw new NotFoundException('Price control setting not found');

//   setting.value = { ...setting.value, ...data };
//   const saved = await this.settingRepo.save(setting);
//   await this.cache.del(this.PRICE_KEY); // ← invalidate
//   return saved;
// }

// async setPricePerKm(pricePerKm: number) {
//  const setting = await this.settingRepo.findOne({
//   where: { key: SystemSettingEnum.PRICE_CONTROL },
//  });
//  if (!setting) throw new NotFoundException('Price control setting not found');
//  setting.value = { ...setting.value, pricePerKm };
//  const saved = await this.settingRepo.save(setting);
//  await this.cache.del(this.PRICE_KEY);
//  return saved;
// }

// /**
//  * Set the driver-board dispatch window hours — how far ahead of departure a
//  * MATCHING pool is pushed to the board — for intra-state and/or inter-state
//  * trips. Either field alone is fine (updates just that one); at least one
//  * must be provided. Stored on the same price-control row as everything else
//  * price/timing related, so `getPriceControl()` and the fare/matching logic
//  * that already reads it keep working unchanged.
//  */
// async setDispatchWindow(dto: {
//   intraStateDispatchWindowHours?: number;
//   interStateDispatchWindowHours?: number;
// }) {
//   if (
//     dto.intraStateDispatchWindowHours == null &&
//     dto.interStateDispatchWindowHours == null
//   ) {
//     throw new BadRequestException(
//       'Provide intraStateDispatchWindowHours and/or interStateDispatchWindowHours',
//     );
//   }
//   const setting = await this.settingRepo.findOne({
//     where: { key: SystemSettingEnum.PRICE_CONTROL },
//   });
//   if (!setting) throw new NotFoundException('Price control setting not found');
//   setting.value = { ...setting.value, ...dto };
//   const saved = await this.settingRepo.save(setting);
//   await this.cache.del(this.PRICE_KEY);
//   return saved;
// }

// /** Just the two dispatch-window hours, with defaults filled in if unset. */
// async getDispatchWindow(): Promise<{
//   intraStateDispatchWindowHours: number;
//   interStateDispatchWindowHours: number;
// }> {
//   let settings: Partial<PriceControlDto> = {};
//   try {
//     settings = (await this.getPriceControl()) ?? {};
//   } catch {
//     // No price-control row yet — fall back to defaults silently.
//   }
//   return {
//     intraStateDispatchWindowHours: settings.intraStateDispatchWindowHours ?? 12,
//     interStateDispatchWindowHours: settings.interStateDispatchWindowHours ?? 18,
//   };
// }


// async getPreferredTimeSlots(): Promise<PreferredTimeSlotDto[]> {
//   const cached = await this.cache.get<PreferredTimeSlotDto[]>(this.TIME_SLOT_KEY);
//   if (cached) return cached;

//   const setting = await this.settingRepo.findOne({
//     where: { key: SystemSettingEnum.PREFRERRED_TIME_SLOTS },
//   });

//   const slots = (setting?.value?.slots as PreferredTimeSlotDto[]) ?? this.DEFAULT_SLOTS;
//   await this.cache.set(this.TIME_SLOT_KEY, slots);
//   return slots;
// }

// async setPreferredTimeSlots(dto: SetPreferredTimeSlotsDto) {
//   this.assertUniqueKeys(dto.slots);

//   let setting = await this.settingRepo.findOne({
//     where: { key: SystemSettingEnum.PREFRERRED_TIME_SLOTS },
//   });

//   if (!setting) {
//     setting = this.settingRepo.create({
//       key: SystemSettingEnum.PREFRERRED_TIME_SLOTS,
//       value: {},
//     });
//   }

//   setting.value = { ...setting.value, slots: dto.slots };
//   const saved = await this.settingRepo.save(setting);
//   await this.cache.del(this.TIME_SLOT_KEY);
//   return saved;
// }

// async addPreferredTimeSlot(slot: PreferredTimeSlotDto) {
//   const slots = await this.getPreferredTimeSlots();
//   if (slots.some((s) => s.key === slot.key)) {
//     throw new ConflictException(`Slot with key "${slot.key}" already exists`);
//   }
//   const updated = [...slots, slot].sort((a, b) => a.order - b.order);
//   return this.setPreferredTimeSlots({ slots: updated });
// }

// async updatePreferredTimeSlot(key: string, patch: Partial<Omit<PreferredTimeSlotDto, 'key'>>) {
//   const slots = await this.getPreferredTimeSlots();
//   const idx = slots.findIndex((s) => s.key === key);
//   if (idx === -1) throw new NotFoundException(`Slot "${key}" not found`);
//   const updated = [...slots];
//   updated[idx] = { ...updated[idx], ...patch };
//   return this.setPreferredTimeSlots({ slots: updated });
// }

// async removePreferredTimeSlot(key: string) {
//   const slots = await this.getPreferredTimeSlots();
//   const filtered = slots.filter((s) => s.key !== key);
//   if (filtered.length === slots.length) throw new NotFoundException(`Slot "${key}" not found`);
//   if (filtered.length === 0) throw new BadRequestException('At least one preferred time slot must remain');
//   return this.setPreferredTimeSlots({ slots: filtered });
// }

// async reorderPreferredTimeSlots(orderedKeys: string[]) {
//   const slots = await this.getPreferredTimeSlots();
//   const valid = orderedKeys.length === slots.length &&
//     orderedKeys.every((k) => slots.some((s) => s.key === k));
//   if (!valid) throw new BadRequestException('orderedKeys must match existing slot keys exactly');

//   const byKey = new Map(slots.map((s) => [s.key, s]));
//   const reordered = orderedKeys.map((key, order) => ({ ...byKey.get(key)!, order }));
//   return this.setPreferredTimeSlots({ slots: reordered });
// }

// async getPriceControl(): Promise<PriceControlDto> {
//   return this.cache.getOrSet(
//     this.PRICE_KEY,
//     async () => {
//       const setting = await this.settingRepo.findOne({
//         where: { key: SystemSettingEnum.PRICE_CONTROL },
//       });
//       if (!setting) throw new NotFoundException('Price control setting not found');
//       return setting.value as PriceControlDto;
//     },
//     CACHE_TTL.HOUR,
//   );
// }

//   // ─── Referral Program ────────────────────────────────────────────────────────

// async setReferralProgram(data: ReferralProgramDto) {
//   const setting = await this.settingRepo.findOne({
//     where: { key: SystemSettingEnum.REFERRAL_PROGRAM },
//   });
//   if (!setting) throw new NotFoundException('Referral program setting not found');

//   setting.value = { ...setting.value, ...data };
//   const saved = await this.settingRepo.save(setting);
//   await this.cache.del(this.REFERRAL_KEY); // ← invalidate
//   return saved;
// }

// async getReferralProgram(): Promise<ReferralProgramDto> {
//   return this.cache.getOrSet(
//     this.REFERRAL_KEY,
//     async () => {
//       const setting = await this.settingRepo.findOne({
//         where: { key: SystemSettingEnum.REFERRAL_PROGRAM },
//       });
//       if (!setting) throw new NotFoundException('Referral program setting not found');
//       return setting.value as ReferralProgramDto;
//     },
//     CACHE_TTL.HOUR,
//   );
// }

//   // ─── Seed Default Settings (run once on app bootstrap) ───────────────────────

//   async seedDefaults() {
//     const defaults = [
//       {
//         key: SystemSettingEnum.PRICE_CONTROL,
//         description: 'Controls platform pricing and commission rates',
//         value: {
//           agentEarningAmount: 50000,
//           platformCommissionRate: 10,
//           driverEarningRate: 85,
//           minTripPrice: 500,
//           maxTripPrice: 100000,
//           intraStateDispatchWindowHours: 12,
//           interStateDispatchWindowHours: 18,
//         } as PriceControlDto,
//       },
//       {
//         key: SystemSettingEnum.REFERRAL_PROGRAM,
//         description: 'Controls agent referral earning rules',
//         value: {
//           earningPerTrip: 1000,
//           maxEarningPerDriver: 50000,
//           referralBonus: 0,
//           isActive: true,
//         } as ReferralProgramDto,
//       },
//     ];

//     for (const item of defaults) {
//       const exists = await this.settingRepo.findOne({ where: { key: item.key } });
//       if (!exists) {
//         await this.settingRepo.save(this.settingRepo.create(item));
//       }
//     }
//   }


//   private assertUniqueKeys(slots: PreferredTimeSlotDto[]) {
//   const seen = new Set<string>();
//   for (const s of slots) {
//     if (seen.has(s.key)) throw new BadRequestException(`Duplicate slot key "${s.key}"`);
//     seen.add(s.key);
//   }
// }
// }

