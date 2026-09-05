import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { CategoriesQueryDto } from './dto/categories-query.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import { SubmitExpenseDto } from './dto/submit-expense.dto';
import { ExpenseService } from './expense.service';

@ApiTags('expense')
@ApiBearerAuth()
@Controller('expense')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Get('categories')
  @ApiOperation({
    summary: 'List active expense categories with budget limit / remaining amounts',
  })
  categories(@CurrentUser() user: AuthUser, @Query() query: CategoriesQueryDto) {
    return this.expenseService.categories(user.id, query.amount);
  }

  @Post('receipt/upload')
  @ApiOperation({ summary: 'Upload a receipt image or PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadReceipt(@CurrentUser() user: AuthUser, @UploadedFile() file: Express.Multer.File) {
    return this.expenseService.uploadReceipt(user.id, file);
  }

  @Get('history')
  @ApiOperation({ summary: 'Paginated expense history for the current employee' })
  history(@CurrentUser() user: AuthUser, @Query() query: HistoryQueryDto) {
    return this.expenseService.history(user.id, query);
  }

  @Get(':claimId/status')
  @ApiOperation({ summary: 'Lightweight claim approval and payment status' })
  claimStatus(@CurrentUser() user: AuthUser, @Param('claimId') claimId: string) {
    return this.expenseService.claimStatus(user.id, claimId);
  }

  @Get(':claimId')
  @ApiOperation({ summary: 'Full expense claim detail with timeline' })
  detail(@CurrentUser() user: AuthUser, @Param('claimId') claimId: string) {
    return this.expenseService.detail(user.id, claimId);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a new expense claim' })
  submit(@CurrentUser() user: AuthUser, @Body() dto: SubmitExpenseDto) {
    return this.expenseService.submit(user.id, dto);
  }
}
