import { Module } from '@nestjs/common';
import { AdminBudgetService } from './admin-budget.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminClaimsService } from './admin-claims.service';
import { AdminClaimsController } from './admin-claims.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminCategoriesController, AdminRoleCapsController, AdminRolesController } from './admin-catalog.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminSettlementsController, AdminWalletsController } from './admin-finance.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [
    AdminDashboardController,
    AdminClaimsController,
    AdminCategoriesController,
    AdminRolesController,
    AdminRoleCapsController,
    AdminUsersController,
    AdminSettlementsController,
    AdminWalletsController,
  ],
  providers: [
    AdminBudgetService,
    AdminDashboardService,
    AdminClaimsService,
    AdminCatalogService,
    AdminUsersService,
    AdminFinanceService,
  ],
})
export class AdminModule {}
