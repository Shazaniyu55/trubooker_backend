import { IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Per-km rate, set separately for inter-state and intra-state trips since
 * they're priced independently (e.g. ₦200/km inter-state, ₦315/km
 * intra-state). Both optional so an admin can update just one at a time; at
 * least one must be provided (enforced in the service).
 */
export class SetPerKmRateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  interStatePerKmRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  intraStatePerKmRate?: number;
}