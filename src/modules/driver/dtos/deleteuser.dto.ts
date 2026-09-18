import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DeleteUserDto {
  @ApiPropertyOptional({
    example: 'Account closed at user request',
    description: 'Optional reason for deleting the account',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deleteReason?: string;
}