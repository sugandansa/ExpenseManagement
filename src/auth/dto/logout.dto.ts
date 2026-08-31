import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ example: 'rtk_...' })
  @IsString()
  @MinLength(16)
  refreshToken: string;

  @ApiPropertyOptional({ example: 'dev_token' })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  deviceId?: string;
}
