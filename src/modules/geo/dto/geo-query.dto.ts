import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListStatesQueryDto {
  /** Case-insensitive partial match on state name, e.g. "lag". */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filter by geopolitical zone, e.g. "South West". */
  @IsOptional()
  @IsString()
  zone?: string;

  /** When true, each state includes its LGAs. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  withLgas?: boolean;
}

export class ListLgasQueryDto {
  /** Restrict to a single state. */
  @IsOptional()
  @IsUUID()
  stateId?: string;

  /** Case-insensitive partial match on LGA name. */
  @IsOptional()
  @IsString()
  q?: string;
}