import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

const ADMIN_ACCOUNT_ROLES = ['admin', 'owner'] as const;

export class CreateAdminAccountDto {
  @ApiProperty({ example: 'Admin Name' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'admin@company.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiProperty({ example: '1234567890' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'phone must be a 10-digit number' })
  phone!: string;

  @ApiProperty({ enum: ADMIN_ACCOUNT_ROLES, example: 'admin' })
  @IsIn(ADMIN_ACCOUNT_ROLES)
  role!: (typeof ADMIN_ACCOUNT_ROLES)[number];

  @ApiPropertyOptional({ example: 'Finance' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  department?: string;
}
