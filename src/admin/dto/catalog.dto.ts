import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Electricals' }) @IsString() @MaxLength(80) name!: string;
  @ApiProperty({ example: 5000 }) @IsNumber() @Min(0) monthlyCap!: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive = true;
}
export class UpdateCategoryDto {
  @ApiPropertyOptional({ example: 9000 }) @IsOptional() @IsNumber() @Min(0) monthlyCap?: number;
  @ApiPropertyOptional({ example: 'Cleaning' }) @IsOptional() @IsString() @MaxLength(80) name?: string;
}
export class UpdateCategoryCapDto {
  @ApiProperty({ example: 9000 }) @IsNumber() @Min(0) monthlyCap!: number;
}
export class UpdateCategoryStatusDto {
  @ApiProperty({ example: false }) @IsBoolean() isActive!: boolean;
}
export class CreateSubcategoryDto {
  @ApiProperty({ example: 'Tea' }) @IsString() @MaxLength(80) name!: string;
}
export class UpdateRoleCapDto {
  @ApiProperty({ example: 18000 }) @IsNumber() @Min(0) monthlyCap!: number;
  @ApiPropertyOptional({ example: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
