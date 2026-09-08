import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { IntQuery } from '../../common/dto/int-query';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class HistoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    example: 'all',
    description: 'pending | approved | paid | all (over-budget claims return as pending with isOverBudget)',
  })
  @IsOptional()
  @IsString()
  status = 'all';

  @ApiPropertyOptional({ example: '2024-08' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'month must be YYYY-MM' })
  month?: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IntQuery()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  categoryId?: number;

  @ApiPropertyOptional({ example: 5, description: 'Filter by subcategory id' })
  @IsOptional()
  @IntQuery()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  subCategoryId?: number;
}
