import { Module } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { ExpenseController } from './expense.controller';
import { ExpenseService } from './expense.service';

@Module({ controllers: [ExpenseController], providers: [ExpenseService, StorageService] })
export class ExpenseModule {}
