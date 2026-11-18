import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAdminAccountDto } from './dto/admin-accounts.dto';

@Injectable()
export class AdminAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateAdminAccountDto) {
    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email?.trim() || null,
          phone: dto.phone,
          role: dto.role,
          department: dto.department?.trim() || null,
          isActive: true,
          passwordHash: null,
        },
      });

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        status: user.isActive ? 'active' : 'inactive',
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Phone number already registered');
      }
      throw error;
    }
  }
}
