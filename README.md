# Expense Management API

NestJS + Prisma API for employee expense claims, OTP login, admin approvals, wallet, and app config.

- Public API: https://api.schoollift.in/expense-management
- Swagger: https://api.schoollift.in/expense-management/docs
- Database: `ExpenseManagement`

## Setup

```bash
cp .env.example .env
# set DATABASE_URL, JWT_SECRET, OTP_PEPPER
npm install
npx prisma generate
mysql -u USER -p < prisma/sql/001_init.sql
mysql -u USER -p < prisma/sql/002_seed.sql
mysql -u USER -p < prisma/sql/003_admin.sql
npm run start:dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Watch mode |
| `npm test` | Unit tests |
| `npm run test:e2e` | Health e2e |
| `npm run build` | Compile |

Employee OTP login uses phone `9876543210`. Owner password login uses phone `9000000001` (set password hash in seed/admin SQL).

## Test numbers

There is no SMS provider wired up yet, so a random OTP can never reach a caller. Phones listed in
`OTP_TEST_PHONES` always receive the fixed code in `OTP_TEST_CODE`; every other phone still gets a
random six-digit code. Clear `OTP_TEST_CODE` to turn the whitelist off before going live with real SMS.

```
OTP_TEST_CODE=123456
OTP_TEST_PHONES=9876543210,9000000001
```
