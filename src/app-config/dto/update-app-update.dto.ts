import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Matches, Min } from 'class-validator';

export class UpdateAppUpdateDto {
  @ApiProperty({ example: 1, description: 'Minimum Android build code that must update' })
  @IsInt()
  @Min(0)
  force_update_android!: number;

  @ApiProperty({ example: 1, description: 'Latest Android build code available' })
  @IsInt()
  @Min(0)
  app_update_android!: number;

  @ApiProperty({ example: '1.0.0', description: 'Minimum iOS version that must update' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'force_update_ios must be semver (e.g. 1.0.0)' })
  force_update_ios!: string;

  @ApiProperty({ example: '1.0.0', description: 'Latest iOS version available' })
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'app_update_ios must be semver (e.g. 1.0.0)' })
  app_update_ios!: string;
}
