import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^ExponentPushToken\[.+\]$/, { message: 'Invalid Expo push token' })
  expoToken: string;
}