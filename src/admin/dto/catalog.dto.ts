import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electricals' }) @IsString() @MaxLength(80) name!: string;
  @ApiProperty({ example: 5000 }) @IsNumber() @Min(0) monthlyCap!: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive = true;
  @ApiPropertyOptional({ example: ['Taxi', 'Fuel'], description: 'Optional subcategory names (items)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  items?: string[];
}
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 9000 }) @IsOptional() @IsNumber() @Min(0) monthlyCap?: number;
  @ApiPropertyOptional({ example: 'Travel' }) @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional({
    example: ['Taxi', 'Fuel', 'Lodging'],
    description: 'When provided, syncs active subcategory names for this category',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(80, { each: true })
  @Type(() => String)
  items?: string[];
}
export class UpdateCategoryCapDto {
  @ApiProperty({ example: 9000 }) @IsNumber() @Min(0) monthlyCap!: number;
}
export class UpdateCategoryStatusDto {
  @ApiProperty({ example: false }) @IsBoolean() isActive!: boolean;
}
export class CreateSubcategoryDto {
  @ApiProperty({ example: 'Tea' }) @IsString() @MaxLength(80) name!: string;
  @ApiPropertyOptional({ example: 5000, description: 'Monthly budget limit for this subcategory' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyCap?: number;
}

export class UpdateSubcategoryDto {
  @ApiPropertyOptional({ example: 'Tea' }) @IsOptional() @IsString() @MaxLength(80) name?: string;
  @ApiPropertyOptional({ example: 5000 }) @IsOptional() @IsNumber() @Min(0) monthlyCap?: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRoleCapDto {
  @ApiProperty({ example: 18000 }) @IsNumber() @Min(0) monthlyCap!: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Quality Checker' }) @IsString() @MinLength(1) @MaxLength(80) name!: string;
  @ApiPropertyOptional({ example: 'Quality checking and inspection staff' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
  @ApiProperty({ example: 8000 }) @IsNumber() @Min(0) monthlyCap!: number;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ example: 'Quality Checker' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;
  @ApiPropertyOptional({ example: 'Quality inspection and checking staff' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
  @ApiPropertyOptional({ example: 10000 }) @IsOptional() @IsNumber() @Min(0) monthlyCap?: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
