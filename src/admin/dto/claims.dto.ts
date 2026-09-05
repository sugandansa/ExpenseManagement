import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { IntQuery } from '../../common/dto/int-query';

export class AdminClaimsQueryDto {
  @ApiPropertyOptional({ example: 'open' }) @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional({ example: 101 }) @IsOptional() @IntQuery() @Type(() => Number) @IsInt() employeeId?: number;
  @ApiPropertyOptional({ example: '2026-08' }) @IsOptional() @IsString() month?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IntQuery(1) @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IntQuery(20) @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}

export class ApproveClaimDto {
  @ApiPropertyOptional({ example: null, nullable: true }) @IsOptional() @IsString() @MaxLength(500) comment?: string | null;
}
export class RejectClaimDto {
  @ApiProperty({ example: 'Duplicate claim' }) @IsString() @MaxLength(500) reason!: string;
}
export class BulkApproveDto {
  @ApiProperty({ example: ['C_1065', 'C_1066'] }) @IsArray() @ArrayNotEmpty() @IsString({ each: true }) claimIds!: string[];
}
