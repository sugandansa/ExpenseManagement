import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, IsString, IsUrl, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ADMIN_ROLES } from './admin.constants';

class PushKeysDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(255) p256dh!: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(255) auth!: string;
}

class PushEndpointDto {
  @ApiProperty() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(512) endpoint!: string;
}

class PushSubscriptionDto extends PushEndpointDto {
  @ApiProperty({ type: PushKeysDto }) @IsDefined() @ValidateNested() @Type(() => PushKeysDto) keys!: PushKeysDto;
}

@ApiTags('admin-push')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/push')
export class AdminPushController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('vapid-public-key')
  publicKey() {
    const publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    if (!publicKey) throw new ServiceUnavailableException('Push notifications are not configured');
    return { success: true, data: { publicKey } };
  }

  @Post('subscriptions')
  async save(@Body() dto: PushSubscriptionDto, @CurrentUser() user: AuthUser) {
    const existing = await this.prisma.pushSubscription.findUnique({ where: { endpoint: dto.endpoint } });
    if (existing && existing.userId !== user.id) throw new ConflictException('Subscription belongs to another user');
    const subscription = existing
      ? await this.prisma.pushSubscription.update({
          where: { id: existing.id },
          data: { p256dh: dto.keys.p256dh, auth: dto.keys.auth },
        })
      : await this.prisma.pushSubscription.create({
          data: { userId: user.id, endpoint: dto.endpoint, p256dh: dto.keys.p256dh, auth: dto.keys.auth },
        });
    return {
      success: true,
      message: 'Push subscription saved successfully',
      data: { subscriptionId: subscription.id, status: 'ACTIVE' },
    };
  }

  @Get('subscriptions')
  saveGet(@Body() dto: PushSubscriptionDto, @CurrentUser() user: AuthUser) {
    return this.save(dto, user);
  }

  @Delete('subscriptions')
  async remove(@Body() dto: PushEndpointDto, @CurrentUser() user: AuthUser) {
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint: dto.endpoint, userId: user.id } });
    return { success: true, message: 'Push subscription deleted successfully' };
  }
}
