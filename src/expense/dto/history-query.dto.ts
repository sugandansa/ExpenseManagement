import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class HistoryQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @ApiPropertyOptional({ example: 'all' }) @IsOptional() @IsString() status = 'all';
  @ApiPropertyOptional({ example: '2024-08' }) @IsOptional() @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' }) month?: string;
}
