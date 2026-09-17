import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * How many hours before departure a MATCHING pool of requests is pushed to
 * the driver board — set separately for intra-state and inter-state trips.
 * Both are optional so an admin can update just one at a time; at least one
 * must be provided (enforced in the service).
 */
export class SetDispatchWindowDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168) // 1 week — generous ceiling, still guards against fat-finger input
  intraStateDispatchWindowHours?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  interStateDispatchWindowHours?: number;
}