import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersQueryDto, CreateUserDto, UpdateUserDto, UpdateUserStatusDto } from './dto/users.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  @ApiOperation({ summary: 'List employee users' })
  list(@Query() query: AdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get employee user by id' })
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.users.getById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create an employee user' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an employee user' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Change employee user active status' })
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserStatusDto) {
    return this.users.updateStatus(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an employee user (blocked if they have claims)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.users.remove(id);
  }
}
