import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class CategoriesQueryDto {
  @ApiPropertyOptional({
    example: 1200,
    description: 'Proposed claim amount — used to compute remainingAfter / fitsBudget for UI copy',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(Array.isArray(value) ? value[value.length - 1] : value);
    return Number.isFinite(parsed) ? parsed : undefined;
  })
  @IsNumber()
  @Min(0)
  amount?: number;
}
