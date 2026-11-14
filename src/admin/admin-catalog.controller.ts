import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ADMIN_ROLES } from './admin.constants';
import { AdminCatalogService } from './admin-catalog.service';
import {
  CreateCategoryDto,
  CreateRoleDto,
  CreateSubcategoryDto,
  UpdateCategoryCapDto,
  UpdateCategoryDto,
  UpdateCategoryStatusDto,
  UpdateRoleCapDto,
  UpdateRoleDto,
  UpdateSubcategoryDto,
} from './dto/catalog.dto';

@ApiTags('admin-categories')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get() @ApiOperation({ summary: 'List categories and monthly caps' }) list() {
    return this.catalog.categories();
  }
  @Post() @ApiOperation({ summary: 'Create a category' }) create(@Body() dto: CreateCategoryDto) {
    return this.catalog.createCategory(dto);
  }
  @Post(':categoryId/subcategories')
  @ApiOperation({ summary: 'Add a subcategory' })
  addSubcategory(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: CreateSubcategoryDto) {
    return this.catalog.addSubcategory(categoryId, dto);
  }
  @Patch('subcategories/:subCategoryId')
  @ApiOperation({ summary: 'Update subcategory name, limit, or status' })
  updateSubcategory(@Param('subCategoryId', ParseIntPipe) subCategoryId: number, @Body() dto: UpdateSubcategoryDto) {
    return this.catalog.updateSubcategory(subCategoryId, dto);
  }
  @Patch(':categoryId/cap')
  @ApiOperation({ summary: 'Update a category monthly cap and re-evaluate flags' })
  updateCap(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryCapDto) {
    return this.catalog.updateCap(categoryId, dto);
  }
  @Patch(':categoryId/status')
  @ApiOperation({ summary: 'Enable or disable a category for new claims' })
  updateStatus(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryStatusDto) {
    return this.catalog.updateStatus(categoryId, dto);
  }
  @Put(':categoryId')
  @ApiOperation({ summary: 'Edit category name, monthly cap, and subcategory items' })
  replace(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(categoryId, dto);
  }
  @Patch(':categoryId')
  @ApiOperation({ summary: 'Update category name and/or cap (and optional items)' })
  update(@Param('categoryId', ParseIntPipe) categoryId: number, @Body() dto: UpdateCategoryDto) {
    return this.catalog.updateCategory(categoryId, dto);
  }
  @Delete(':categoryId')
  @ApiOperation({ summary: 'Delete a category (blocked if any claims are mapped)' })
  remove(@Param('categoryId', ParseIntPipe) categoryId: number) {
    return this.catalog.deleteCategory(categoryId);
  }
}

@ApiTags('admin-roles')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/roles')
export class AdminRolesController {
  constructor(private readonly catalog: AdminCatalogService) {}

  @Get()
  @ApiOperation({ summary: 'List job roles (role caps) with user counts' })
  list() {
    return this.catalog.listRoles();
  }

  @Post()
  @ApiOperation({ summary: 'Create a job role with monthly spending cap' })
  create(@Body() dto: CreateRoleDto) {
    return this.catalog.createRole(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a job role (does not rewrite existing user departments)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRoleDto) {
    return this.catalog.updateRole(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a job role (blocked if assigned to users)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.catalog.deleteRole(id);
  }
}

@ApiTags('admin-role-caps')
@ApiBearerAuth()
@Roles(...ADMIN_ROLES)
@UseGuards(RolesGuard)
@Controller('admin/role-caps')
export class AdminRoleCapsController {
  constructor(private readonly catalog: AdminCatalogService) {}
  @Get()
  @ApiOperation({ summary: 'List role spending caps with users and current-month spend' })
  list() {
    return this.catalog.roleCaps();
  }
  @Patch(':role')
  @ApiOperation({ summary: 'Create or update a role cap and re-evaluate flags' })
  update(@Param('role') role: string, @Body() dto: UpdateRoleCapDto) {
    return this.catalog.updateRoleCap(role, dto);
  }
}
