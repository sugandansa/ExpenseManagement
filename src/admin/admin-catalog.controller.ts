import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminCatalogService } from './admin-catalog.service';
import { CreateCategoryDto, CreateSubcategoryDto, UpdateCategoryCapDto, UpdateCategoryDto, UpdateCategoryStatusDto, UpdateRoleCapDto } from './dto/catalog.dto';

@ApiTags('admin-categories') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get() @ApiOperation({ summary: 'List categories and monthly caps' }) list() { return this.catalog.categories(); }
  @Post() @ApiOperation({ summary: 'Create a category' }) create(@Body() dto: CreateCategoryDto) { return this.catalog.createCategory(dto); }
  @Post(':categoryId/subcategories') @ApiOperation({ summary: 'Add a subcategory' })
  addSubcategory(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: CreateSubcategoryDto) { return this.catalog.addSubcategory(categoryId, dto); }
  @Patch(':categoryId/cap') @ApiOperation({ summary: 'Update a category monthly cap and re-evaluate flags' })
  updateCap(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryCapDto) { return this.catalog.updateCap(categoryId, dto); }
  @Patch(':categoryId/status') @ApiOperation({ summary: 'Enable or disable a category for new claims' })
  updateStatus(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryStatusDto) { return this.catalog.updateStatus(categoryId, dto); }
  @Patch(':categoryId') @ApiOperation({ summary: 'Update category name and/or cap' })
  update(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryDto) { return this.catalog.updateCategory(categoryId, dto); }
}

@ApiTags('admin-role-caps') @ApiBearerAuth() @Roles(...ADMIN_ROLES) @UseGuards(RolesGuard) @Controller('admin/role-caps')
export class AdminRoleCapsController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get() @ApiOperation({ summary: 'List role spending caps' }) list() { return this.catalog.roleCaps(); }
  @Patch(':role') @ApiOperation({ summary: 'Create or update a role cap and re-evaluate flags' })
  update(@Param('role') role: string, @Body() dto: UpdateRoleCapDto) { return this.catalog.updateRoleCap(role, dto); }
}
