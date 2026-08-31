import { PrismaService } from '../prisma/prisma.service';
import { EmployeeService } from './employee.service';

describe('EmployeeService', () => {
  it('is created', () => expect(new EmployeeService({} as PrismaService)).toBeDefined());
});
