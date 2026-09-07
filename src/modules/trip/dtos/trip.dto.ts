import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform  } from 'class-transformer';
import { TripStatus, VehicleType } from '../../../types/enums';
import { IQuery, Order } from '@shared/interface/query.interface';

// ─── Driver creates a trip ─────────────────────────────────────────────────

export class CreateTripDto {
  @ApiProperty({ example: 'Lagos (CMS)' })
  @IsNotEmpty() @IsString() origin: string;

  @ApiProperty({ example: 'Abuja (Wuse)' })
  @IsNotEmpty() @IsString() destination: string;


  @ApiProperty({ example: '07:00', description: 'Departure time in HH:mm or HH:mm:ss format' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'departureTime must be in HH:mm or HH:mm:ss format',
  })
  departureTime: string;

  // @ApiProperty({ example: '2025-08-15T07:00:00.000Z' })
  // @IsNotEmpty() @IsDateString() departureTime: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'arrivalTime must be in HH:mm or HH:mm:ss format' })
  @IsOptional()
  arrivalTime?: string;

  // @ApiPropertyOptional({ example: '2025-08-15T15:00:00.000Z' })
  // @IsOptional() @IsDateString() arrivalTime?: string;

  @ApiProperty({ example: 14, description: 'Total seats available' })
  @IsPositive() @Min(1) @IsNumber() totalSeats: number;

  @ApiProperty({ example: 7500, description: 'Price per seat in NGN' })
  @IsPositive() @IsNumber() pricePerSeat: number;

  @ApiPropertyOptional({ description: 'Vehicle ID (must belong to driver)' })
  @IsOptional() @IsNumber() vehicleId?: string;

  @ApiPropertyOptional({
    description: 'Intermediate stops',
    example: [{ city: 'Ore', coordinates: { lat: 6.74, lng: 4.86 } }],
  })
  @IsOptional() @IsArray() waypoints?: any[];

  @ApiPropertyOptional()
  @IsOptional() metadata?: Record<string, any>;

  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'bookingClosingTime must be in HH:mm or HH:mm:ss format' })
  @IsOptional()
  bookingClosingTime?: string;

  @ApiProperty({ example: '2025-08-25', description: 'Departure date (YYYY-MM-DD)' })
@IsNotEmpty() @IsString() departureDate: string;
}

// ─── Update trip ───────────────────────────────────────────────────────────

export class UpdateTripDto {
  @ApiPropertyOptional() @IsOptional() @IsString() origin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() destination?: string;
  @ApiProperty({ example: '07:00', description: 'Departure time in HH:mm or HH:mm:ss format' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'departureTime must be in HH:mm or HH:mm:ss format',
  })
  departureTime: string;
  // @ApiPropertyOptional() @IsOptional() @IsDateString() departureTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() arrivalTime?: string;
  @ApiPropertyOptional() @IsOptional() @IsPositive() @IsNumber() totalSeats?: number;
  @ApiPropertyOptional() @IsOptional() @IsPositive() @IsNumber() pricePerSeat?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() vehicleId?: number;
  @ApiPropertyOptional() @IsOptional() @IsArray() waypoints?: any[];
}

// ─── Passenger books a trip ────────────────────────────────────────────────
export class ExtraLuggageDto {
  @ApiProperty({ example: 12, description: 'Luggage weight in kg' })
  @IsPositive() @IsNumber() weight: number;
}


export class BookTripDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty() @IsUUID() tripId: string;

  @ApiProperty({ example: 2, description: 'Number of seats to book' })
  @IsPositive() @Min(1) @IsNumber() seats: number;

  @ApiPropertyOptional({ description: 'Discount coupon code' })
  @IsOptional() @IsString() couponCode?: string;

  @ApiPropertyOptional({ description: 'Payment redirect URL after Paystack checkout' })
  @IsOptional() callbackUrl?: string;

  @ApiPropertyOptional({ type: [ExtraLuggageDto] })
@IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExtraLuggageDto)
extraLuggage?: ExtraLuggageDto[];
}

// ─── Trip search / filter ──────────────────────────────────────────────────

export class SearchTripsDto {
  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional() @IsString() origin?: string;

  @ApiPropertyOptional({ example: 'Abuja' })
  @IsOptional() @IsString() destination?: string;

  @ApiPropertyOptional({ example: '2025-08-15' })
  @IsOptional() @IsString() date?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) seats?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;

  @ApiPropertyOptional({ enum: TripStatus })
  @IsOptional() @IsEnum(TripStatus) status?: TripStatus;

  @ApiPropertyOptional({ description: 'Max price per seat' })
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;

  @ApiPropertyOptional({ description: 'Sort by price | departure | seats' })
  @IsOptional() @IsString() sortBy?: 'price' | 'departure' | 'seats';

  @ApiPropertyOptional({ example: 'Lagos', description: 'Filter trips by state' })
  @IsOptional() @IsString() state?: string;

  @ApiPropertyOptional({ example: 'Ikeja', description: 'Filter trips by city/location' })
  @IsOptional() @IsString() location?: string;

}

// ─── Fare recommendation / estimate ────────────────────────────────────────

export class PriceRecommendationQueryDto {
  @ApiProperty({ example: 'Lagos (CMS)' })
  @IsNotEmpty() @IsString() origin: string;

  @ApiProperty({ example: 'Abuja (Wuse)' })
  @IsNotEmpty() @IsString() destination: string;
}

export class FareEstimateQueryDto {
  @ApiProperty({ example: 'Lagos' })
  @IsNotEmpty() @IsString() origin: string;

  @ApiProperty({ example: 'Ibadan' })
  @IsNotEmpty() @IsString() destination: string;

  @ApiPropertyOptional({
    example: 4,
    description: 'Highest passenger count to estimate for (1–10). Defaults to 4.',
  })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) seats?: number;
}

// ─── Cancel booking ────────────────────────────────────────────────────────

export class CancelBookingDto {
  @ApiProperty({ example: 'uuid' })
  @IsNotEmpty() @IsString() bookingId: string;

  @ApiPropertyOptional({ example: 'Change of plans' })
  @IsOptional() @IsString() reason?: string;
}

// ─── Driver completes trip ─────────────────────────────────────────────────

export class CompleteTripDto {
  @ApiProperty({ example: 'uuid' })
  @IsNotEmpty() @IsString() tripId: string;

  @ApiPropertyOptional({ example: 'Trip completed successfully' })
  @IsOptional() @IsString() notes?: string;
}

export class ScanTicketDto {
  @ApiProperty() @IsNotEmpty() @IsString() bookingCode: string;
  @ApiProperty() @IsNotEmpty() @IsString() ticketToken: string;
}

// ─── Driver cancels trip ───────────────────────────────────────────────────

export class CancelTripDto {
  @ApiProperty({ example: 1 })
  @IsNotEmpty() @IsString() tripId: string;

  @ApiProperty({ example: 'Vehicle breakdown' })
  @IsNotEmpty() @IsString() reason: string;
}

export class TripListQueryDto implements IQuery {
  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, enum: Order, default: Order.DESC })
  @IsOptional()
  @IsEnum(Order)
  order?: Order = Order.DESC;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  role?: string;
}
// ─── Driver: Manually verify a booking by code (QR fallback) ───────────────

export class VerifyBookingDto {
  @ApiProperty({ example: 'A1B2C3D4', description: 'Booking code shown on the passenger ticket' })
  @IsNotEmpty() @IsString() bookingCode: string;
}

// ─── Driver: Trip chart summary query ───────────────────────────────────────

export class TripChartQueryDto {
  @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'daily' })
  @IsOptional() @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
  filter_by?: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

// ─── Driver: Search passengers booked on a trip ─────────────────────────────

export class TripBookingsQueryDto {
  @ApiPropertyOptional({ description: 'Search by passenger name, email, phone, booking code or status' })
  @IsOptional() @IsString() search?: string;
}

// import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
// import {
//   IsArray,
//   IsDateString,
//   IsEnum,
//   IsIn,
//   IsNotEmpty,
//   IsNumber,
//   IsOptional,
//   IsPositive,
//   IsString,
//   IsUrl,
//   IsUUID,
//   Matches,
//   Min,
//   ValidateNested,
// } from 'class-validator';
// import { Type, Transform  } from 'class-transformer';
// import { TripStatus, VehicleType } from '../../../types/enums';
// import { IQuery, Order } from '@shared/interface/query.interface';

// // ─── Driver creates a trip ─────────────────────────────────────────────────

// export class CreateTripDto {
//   @ApiProperty({ example: 'Lagos (CMS)' })
//   @IsNotEmpty() @IsString() origin: string;

//   @ApiProperty({ example: 'Abuja (Wuse)' })
//   @IsNotEmpty() @IsString() destination: string;


//   @ApiProperty({ example: '07:00', description: 'Departure time in HH:mm or HH:mm:ss format' })
//   @IsNotEmpty()
//   @IsString()
//   @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
//     message: 'departureTime must be in HH:mm or HH:mm:ss format',
//   })
//   departureTime: string;

//   // @ApiProperty({ example: '2025-08-15T07:00:00.000Z' })
//   // @IsNotEmpty() @IsDateString() departureTime: string;

//   @IsString()
//   @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'arrivalTime must be in HH:mm or HH:mm:ss format' })
//   @IsOptional()
//   arrivalTime?: string;

//   // @ApiPropertyOptional({ example: '2025-08-15T15:00:00.000Z' })
//   // @IsOptional() @IsDateString() arrivalTime?: string;

//   @ApiProperty({ example: 14, description: 'Total seats available' })
//   @IsPositive() @Min(1) @IsNumber() totalSeats: number;

//   @ApiProperty({ example: 7500, description: 'Price per seat in NGN' })
//   @IsPositive() @IsNumber() pricePerSeat: number;

//   @ApiPropertyOptional({ description: 'Vehicle ID (must belong to driver)' })
//   @IsOptional() @IsNumber() vehicleId?: string;

//   @ApiPropertyOptional({
//     description: 'Intermediate stops',
//     example: [{ city: 'Ore', coordinates: { lat: 6.74, lng: 4.86 } }],
//   })
//   @IsOptional() @IsArray() waypoints?: any[];

//   @ApiPropertyOptional()
//   @IsOptional() metadata?: Record<string, any>;

//   @IsString()
//   @Matches(/^\d{2}:\d{2}(:\d{2})?$/, { message: 'bookingClosingTime must be in HH:mm or HH:mm:ss format' })
//   @IsOptional()
//   bookingClosingTime?: string;
// }

// // ─── Update trip ───────────────────────────────────────────────────────────

// export class UpdateTripDto {
//   @ApiPropertyOptional() @IsOptional() @IsString() origin?: string;
//   @ApiPropertyOptional() @IsOptional() @IsString() destination?: string;
//   @ApiProperty({ example: '07:00', description: 'Departure time in HH:mm or HH:mm:ss format' })
//   @IsNotEmpty()
//   @IsString()
//   @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
//     message: 'departureTime must be in HH:mm or HH:mm:ss format',
//   })
//   departureTime: string;
//   // @ApiPropertyOptional() @IsOptional() @IsDateString() departureTime?: string;
//   @ApiPropertyOptional() @IsOptional() @IsDateString() arrivalTime?: string;
//   @ApiPropertyOptional() @IsOptional() @IsPositive() @IsNumber() totalSeats?: number;
//   @ApiPropertyOptional() @IsOptional() @IsPositive() @IsNumber() pricePerSeat?: number;
//   @ApiPropertyOptional() @IsOptional() @IsNumber() vehicleId?: number;
//   @ApiPropertyOptional() @IsOptional() @IsArray() waypoints?: any[];
// }

// // ─── Passenger books a trip ────────────────────────────────────────────────
// export class ExtraLuggageDto {
//   @ApiProperty({ example: 12, description: 'Luggage weight in kg' })
//   @IsPositive() @IsNumber() weight: number;
// }


// export class BookTripDto {
//   @ApiProperty({ example: 1 })
//   @IsNotEmpty() @IsUUID() tripId: string;

//   @ApiProperty({ example: 2, description: 'Number of seats to book' })
//   @IsPositive() @Min(1) @IsNumber() seats: number;

//   @ApiPropertyOptional({ description: 'Discount coupon code' })
//   @IsOptional() @IsString() couponCode?: string;

//   @ApiPropertyOptional({ description: 'Payment redirect URL after Paystack checkout' })
//   @IsOptional() callbackUrl?: string;

//   @ApiPropertyOptional({ type: [ExtraLuggageDto] })
// @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ExtraLuggageDto)
// extraLuggage?: ExtraLuggageDto[];
// }

// // ─── Trip search / filter ──────────────────────────────────────────────────

// export class SearchTripsDto {
//   @ApiPropertyOptional({ example: 'Lagos' })
//   @IsOptional() @IsString() origin?: string;

//   @ApiPropertyOptional({ example: 'Abuja' })
//   @IsOptional() @IsString() destination?: string;

//   @ApiPropertyOptional({ example: '2025-08-15' })
//   @IsOptional() @IsString() date?: string;

//   @ApiPropertyOptional({ example: 1 })
//   @IsOptional() @Type(() => Number) @IsNumber() @Min(1) seats?: number;

//   @ApiPropertyOptional({ example: 1 })
//   @IsOptional() @Type(() => Number) @IsNumber() page?: number;

//   @ApiPropertyOptional({ example: 20 })
//   @IsOptional() @Type(() => Number) @IsNumber() limit?: number;

//   @ApiPropertyOptional({ enum: TripStatus })
//   @IsOptional() @IsEnum(TripStatus) status?: TripStatus;

//   @ApiPropertyOptional({ description: 'Max price per seat' })
//   @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;

//   @ApiPropertyOptional({ description: 'Sort by price | departure | seats' })
//   @IsOptional() @IsString() sortBy?: 'price' | 'departure' | 'seats';

//   @ApiPropertyOptional({ example: 'Lagos', description: 'Filter trips by state' })
//   @IsOptional() @IsString() state?: string;

//   @ApiPropertyOptional({ example: 'Ikeja', description: 'Filter trips by city/location' })
//   @IsOptional() @IsString() location?: string;

// }

// // ─── Cancel booking ────────────────────────────────────────────────────────

// export class CancelBookingDto {
//   @ApiProperty({ example: 'uuid' })
//   @IsNotEmpty() @IsString() bookingId: string;

//   @ApiPropertyOptional({ example: 'Change of plans' })
//   @IsOptional() @IsString() reason?: string;
// }

// // ─── Driver completes trip ─────────────────────────────────────────────────

// export class CompleteTripDto {
//   @ApiProperty({ example: 'uuid' })
//   @IsNotEmpty() @IsString() tripId: string;

//   @ApiPropertyOptional({ example: 'Trip completed successfully' })
//   @IsOptional() @IsString() notes?: string;
// }

// export class ScanTicketDto {
//   @ApiProperty() @IsNotEmpty() @IsString() bookingCode: string;
//   @ApiProperty() @IsNotEmpty() @IsString() ticketToken: string;
// }

// // ─── Driver cancels trip ───────────────────────────────────────────────────

// export class CancelTripDto {
//   @ApiProperty({ example: 1 })
//   @IsNotEmpty() @IsString() tripId: string;

//   @ApiProperty({ example: 'Vehicle breakdown' })
//   @IsNotEmpty() @IsString() reason: string;
// }

// export class TripListQueryDto implements IQuery {
//   @ApiProperty({ required: false, default: 1 })
//   @IsOptional()
//   @Type(() => Number)
//   @IsNumber()
//   @Min(1)
//   page?: number = 1;

//   @ApiProperty({ required: false, default: 20 })
//   @IsOptional()
//   @Type(() => Number)
//   @IsNumber()
//   @Min(1)
//   limit?: number = 20;

//   @ApiProperty({ required: false })
//   @IsOptional()
//   @IsString()
//   search?: string;

//   @ApiProperty({ required: false, enum: Order, default: Order.DESC })
//   @IsOptional()
//   @IsEnum(Order)
//   order?: Order = Order.DESC;

//   @ApiProperty({ required: false })
//   @IsOptional()
//   @IsString()
//   status?: string;

//   @ApiProperty({ required: false })
//   @IsOptional()
//   @IsString()
//   role?: string;
// }
// // ─── Driver: Manually verify a booking by code (QR fallback) ───────────────

// export class VerifyBookingDto {
//   @ApiProperty({ example: 'A1B2C3D4', description: 'Booking code shown on the passenger ticket' })
//   @IsNotEmpty() @IsString() bookingCode: string;
// }

// // ─── Driver: Trip chart summary query ───────────────────────────────────────

// export class TripChartQueryDto {
//   @ApiPropertyOptional({ enum: ['daily', 'weekly', 'monthly', 'yearly'], default: 'daily' })
//   @IsOptional() @IsIn(['daily', 'weekly', 'monthly', 'yearly'])
//   filter_by?: 'daily' | 'weekly' | 'monthly' | 'yearly';
// }

// // ─── Driver: Search passengers booked on a trip ─────────────────────────────

// export class TripBookingsQueryDto {
//   @ApiPropertyOptional({ description: 'Search by passenger name, email, phone, booking code or status' })
//   @IsOptional() @IsString() search?: string;
// }

