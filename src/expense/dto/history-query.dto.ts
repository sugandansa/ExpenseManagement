import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class HistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'all' }) @IsOptional() @IsString() status = 'all';
  @ApiPropertyOptional({ example: '2024-08' }) @IsOptional() @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' }) month?: string;
}
