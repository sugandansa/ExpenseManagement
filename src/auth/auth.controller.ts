import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { PasswordVerifyOtpDto, ResetPasswordDto } from './dto/password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Admin password login' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('otp/send')
  @ApiOperation({ summary: 'Send login OTP' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and log in' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Public()
  @Post('password/forgot')
  forgotPassword(@Body() dto: SendOtpDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('password/verify-otp')
  verifyPasswordOtp(@Body() dto: PasswordVerifyOtpDto) {
    return this.authService.verifyPasswordOtp(dto);
  }

  @Public()
  @Post('password/reset')
  resetPassword(@Headers('authorization') authorization: string | undefined, @Body() dto: ResetPasswordDto) {
    const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!token) throw new UnauthorizedException('Reset token required');
    return this.authService.resetPassword(token, dto.newPassword);
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Invalidate the current refresh session' })
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto);
  }

  @ApiBearerAuth()
  @Get('logout')
  logoutCurrent(@CurrentUser() user: AuthUser) {
    return this.authService.logoutCurrent(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get the current user' })
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.id);
  }
}
