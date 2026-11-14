# Expense Management API

NestJS + Prisma API for employee expense claims, OTP login, admin approvals, wallet, and app config.

- Public API: https://smweaves.com/api
- Swagger: https://smweaves.com/docs
- Legacy (SchoolLift path proxy, keep until cutover): https://api.schoollift.in/expense-management
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

## Dashboard APIs

Apply database changes with `pnpm exec prisma migrate deploy` and regenerate the client with `pnpm prisma generate`. Access tokens issued before session binding was introduced must be refreshed or replaced by logging in again. Password reset is available for active admin and owner accounts: request an OTP at `POST /api/auth/password/forgot`, verify it at `POST /api/auth/password/verify-otp`, then send the returned reset token as `Authorization: Bearer <resetToken>` to `POST /api/auth/password/reset`. Reset tokens expire after 10 minutes, can be used once, and reset invalidates existing sessions. `GET /api/auth/logout` revokes the current session; the existing refresh-token-based `POST /api/auth/logout` remains available.

Employee and administrator IDs are numeric database IDs, not the illustrative `EMP001` / `ADMIN001` values. Cash settlements can omit `reference` and include `notes`; settlement amounts cannot exceed the wallet due. Access revoke and restore apply to employee users and require a `reason`.

`GET /api/admin/reports/spends?month=YYYY-MM` and `GET /api/admin/reports/personnel?month=YYYY-MM` download XLSX files. Claims are selected by submission month; personnel settled amounts use settlement month, wallet due is current, and cap usage includes non-rejected claims submitted during the month. Claim settlement columns show only the latest linked settlement, which may not represent every partial payment.

Set `VAPID_PUBLIC_KEY` to expose the push public key. Register subscriptions with `POST /api/admin/push/subscriptions` (the requested GET-with-body form is also accepted where clients support it) and delete them with `DELETE` on the same path. These endpoints store subscriptions; notification delivery requires a separate sender and VAPID private key configuration.
