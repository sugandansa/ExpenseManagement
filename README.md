# Expense Management API

NestJS + Prisma API for employee expense claims, OTP login, admin approvals, wallet, and app config.

- Public API: https://api.schoollift.in/expense-management
- Swagger: https://api.schoollift.in/expense-management/docs
- Database: `ExpenseManagement`
- Package manager: **pnpm** (required)

## Setup

```bash
cp .env.example .env
# set DATABASE_URL, JWT_SECRET, OTP_PEPPER
pnpm install
pnpm prisma generate
mysql -u USER -p < prisma/sql/001_init.sql
mysql -u USER -p < prisma/sql/002_seed.sql
mysql -u USER -p < prisma/sql/003_admin.sql
pnpm start:dev
```

## Scripts

| Command          | Description       |
| ---------------- | ----------------- |
| `pnpm start:dev` | Watch mode        |
| `pnpm test`      | Unit tests        |
| `pnpm lint`      | ESLint            |
| `pnpm format`    | Prettier write    |
| `pnpm typecheck` | TypeScript noEmit |
| `pnpm test:e2e`  | Health e2e        |
| `pnpm build`     | Compile           |

Pre-commit (Husky): runs `lint-staged` (ESLint + Prettier on staged files) then `pnpm test`.

Employee OTP login uses phone `9876543210`. Owner password login uses phone `9000000001` (set password hash in seed/admin SQL).

## OTP / SMS

Real numbers get a random six-digit code via MSG91 Flow (`MSG91_*` env vars, same DLT template as
the SchoolLift API). Phones listed in `OTP_TEST_PHONES` skip SMS and always use `OTP_TEST_CODE`.
Set `MSG91_AUTH_KEY=test` to mock MSG91 locally.

```
OTP_TEST_CODE=123456
OTP_TEST_PHONES=9876543210,9000000001
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...
MSG91_SENDER_ID=WHTOCN
MSG91_OTP_VAR=num
```
