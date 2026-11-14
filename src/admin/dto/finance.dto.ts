import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IntQuery } from '../../common/dto/int-query';

export class CreateSettlementDto {
  @ApiProperty({ example: 101 }) @IsInt() employeeId!: number;
  @ApiProperty({ example: 3250 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) amount!: number;
  @ApiProperty({ example: 'UPI' }) @IsString() @MinLength(2) @MaxLength(40) paymentMethod!: string;
  @ApiPropertyOptional({ example: 'UTR123456789' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}
export class SettlementHistoryQueryDto {
  @ApiPropertyOptional({ example: '2026-08' }) @IsOptional() @IsString() month?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IntQuery(1) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IntQuery(20)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
export class LedgerQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IntQuery(1) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IntQuery(20)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
  @ApiPropertyOptional({ example: '2026-08' }) @IsOptional() @IsString() month?: string;
}
export class MarkSettlementDto {
  @ApiProperty({ example: ['C_1065', 'C_1066'] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  claimIds!: string[];
  @ApiProperty({ example: 'UPI' }) @IsString() @MinLength(2) paymentMethod!: string;
  @ApiProperty({ example: 6650 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) paidAmount!: number;
  @ApiProperty({ example: '2026-08-25T15:00:00' }) @IsString() paidAt!: string;
  @ApiProperty({ example: 'UPI-12345' }) @IsString() @MinLength(3) reference!: string;
}
