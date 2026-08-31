import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EmployeeService } from './employee.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@ApiTags('employee')
@ApiBearerAuth()
@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Employee home dashboard summary' })
  @ApiQuery({ name: 'month', required: false, example: '2024-08' })
  dashboard(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.employeeService.dashboard(user.id, month);
  }
}
