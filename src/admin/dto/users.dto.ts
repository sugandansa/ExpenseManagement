import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { IntQuery } from '../../common/dto/int-query';

const USER_STATUSES = ['active', 'inactive'] as const;

export class AdminUsersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];

  @ApiPropertyOptional({ example: 'Rajesh', description: 'Search by name, phone, or email' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filter by job role (role_caps.id)' })
  @IsOptional()
  @IntQuery()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId?: number;
}

export class CreateUserDto {
  @ApiProperty({ example: 'Rajesh' }) @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @ApiPropertyOptional({ example: 'rajesh@company.com' }) @IsOptional() @IsEmail() @MaxLength(160) email?: string;
  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'phone must be a 10-digit number' })
  phone!: string;
  @ApiProperty({ example: 1, description: 'Job role id from /api/admin/roles' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roleId!: number;
  @ApiPropertyOptional({
    example: 'Production',
    description: 'Org unit / team label. Independent of job role (roleId). Defaults to role name when omitted.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
  @ApiPropertyOptional({ enum: USER_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Rajesh' }) @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @ApiPropertyOptional({ example: 'rajesh@company.com' }) @IsOptional() @IsEmail() @MaxLength(160) email?:
    string | null;
  @ApiPropertyOptional({ example: '9876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/, { message: 'phone must be a 10-digit number' })
  phone?: string;
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) roleId?: number;
  @ApiPropertyOptional({ example: 'Housekeeping' }) @IsOptional() @IsString() @MaxLength(120) department?: string;
  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn(USER_STATUSES)
  status?: (typeof USER_STATUSES)[number];
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: USER_STATUSES, example: 'inactive' })
  @IsIn(USER_STATUSES)
  status!: (typeof USER_STATUSES)[number];
}
