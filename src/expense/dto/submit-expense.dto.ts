import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class SubmitExpenseDto {
  @ApiProperty({ example: 'RC_123' }) @IsString() receiptId!: string;
  @ApiProperty({ example: 1400 }) @IsNumber() @Min(1) amount!: number;
  @ApiProperty({ example: 2 }) @IsInt() categoryId!: number;
  @ApiProperty({ example: 5 }) @IsInt() subCategoryId!: number;
  @ApiPropertyOptional({ example: 'Client visit taxi fare' }) @IsOptional() @IsString() @MaxLength(500) note?: string;
  @ApiProperty({ example: 1724081234, description: 'Unix timestamp in seconds' }) @IsInt() submissionDate!: number;
}
