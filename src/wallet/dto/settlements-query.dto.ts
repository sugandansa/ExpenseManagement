import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class SettlementsQueryDto {
  @ApiPropertyOptional({ example: 1 }) @IsOptional() @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ example: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
}
