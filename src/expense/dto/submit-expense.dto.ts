import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class SubmitExpenseDto {
  @ApiProperty({ example: 'RC_123' }) @IsString() receiptId!: string;
  @ApiProperty({ example: 1400 }) @IsNumber() @Min(1) amount!: number;
  /** Use `0` for the free-text "Other" category (requires `otherCategory`). */
  @ApiProperty({ example: 2, description: 'Category id, or 0 for Other' }) @IsInt() @Min(0) categoryId!: number;
  @ApiPropertyOptional({
    example: 5,
    description: 'Optional subcategory id. Omit for category-only claims.',
  })
  @Transform(({ value }) => {
    if (value === '' || value === null || value === undefined || value === 0 || value === '0') return undefined;
    return typeof value === 'string' ? Number(value) : value;
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  subCategoryId?: number;
  @ApiPropertyOptional({ example: 'Misc vendor payment' })
  @ValidateIf((dto: SubmitExpenseDto) => dto.categoryId === 0)
  @IsString()
  @MaxLength(120)
  otherCategory?: string;
  @ApiPropertyOptional({ example: 'Client visit taxi fare' }) @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiProperty({ example: 1724081234, description: 'Unix timestamp in seconds' }) @IsInt() submissionDate!: number;
}
