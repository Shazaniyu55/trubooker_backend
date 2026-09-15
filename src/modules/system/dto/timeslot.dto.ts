import { Type } from "class-transformer";
import { ArrayMinSize, IsInt, IsNotEmpty, IsString, Matches, Min, ValidateNested } from "class-validator";

export class PreferredTimeSlotDto {
  @IsString() @IsNotEmpty() key: string;
  @IsString() @IsNotEmpty() label: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/, { message: 'time must be HH:mm:ss' })
  time: string;
  @IsString() @IsNotEmpty() range: string;
  @IsInt() @Min(0) order: number;
}

export class SetPreferredTimeSlotsDto {
  @ValidateNested({ each: true })
  @Type(() => PreferredTimeSlotDto)
  @ArrayMinSize(1)
  slots: PreferredTimeSlotDto[];
}