import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { SendOtpDto } from './send-otp.dto';

export class PasswordVerifyOtpDto extends SendOtpDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/)
  otp!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'NewPassword@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
