import { Module } from '@nestjs/common';
import { AdminBudgetService } from './admin-budget.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminClaimsService } from './admin-claims.service';
import { AdminClaimsController } from './admin-claims.controller';
import { AdminCatalogService } from './admin-catalog.service';
import { AdminCategoriesController, AdminRoleCapsController } from './admin-catalog.controller';
import { AdminFinanceService } from './admin-finance.service';
import { AdminSettlementsController, AdminWalletsController } from './admin-finance.controller';

@Module({
  controllers: [AdminDashboardController, AdminClaimsController, AdminCategoriesController, AdminRoleCapsController, AdminSettlementsController, AdminWalletsController],
  providers: [AdminBudgetService, AdminDashboardService, AdminClaimsService, AdminCatalogService, AdminFinanceService],
})
export class AdminModule {}
