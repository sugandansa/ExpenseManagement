# Dashboard API cURL Examples

## Set These Values First

```bash
BASE_URL="https://YOUR_API_HOST/api"
ACCESS_TOKEN="YOUR_ACCESS_TOKEN"
RESET_TOKEN="TOKEN_FROM_VERIFY_OTP"
EMPLOYEE_ID=101
```

Replace the placeholders with your API host and tokens. Admin endpoints require an admin or owner access token. Employee and administrator IDs are numeric. The settlement examples below use employee ID `101`; replace it in the payload as needed.

## Create Cash Settlement

Request payload:

```json
{ "employeeId": 101, "amount": 1500, "paymentMethod": "Cash", "notes": "Cash payment" }
```

```bash
curl -X POST "$BASE_URL/admin/settlements" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":101,"amount":1500,"paymentMethod":"Cash","notes":"Cash payment"}'
```

For UPI, use this payload instead:

```json
{
  "employeeId": 101,
  "amount": 1500,
  "paymentMethod": "UPI",
  "reference": "UTR123456789",
  "notes": "November settlement"
}
```

```bash
curl -X POST "$BASE_URL/admin/settlements" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"employeeId":101,"amount":1500,"paymentMethod":"UPI","reference":"UTR123456789","notes":"November settlement"}'
```

`reference` and `notes` are optional. The amount cannot exceed the employee's wallet due.

## Forgot Password

Password recovery is available for active admin and owner accounts.

Request payload:

```json
{ "phone": "9876543210" }
```

```bash
curl -X POST "$BASE_URL/auth/password/forgot" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210"}'
```

## Verify Password OTP

Request payload:

```json
{ "phone": "9876543210", "otp": "123456" }
```

```bash
curl -X POST "$BASE_URL/auth/password/verify-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","otp":"123456"}'
```

Set `RESET_TOKEN` to the returned `data.resetToken`. It expires after 600 seconds and can be used once.

## Reset Password

Request payload:

```json
{ "newPassword": "NewPassword@123" }
```

```bash
curl -X POST "$BASE_URL/auth/password/reset" \
  -H "Authorization: Bearer $RESET_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"newPassword":"NewPassword@123"}'
```

Resetting the password revokes the user's existing sessions.

## Revoke Employee Access

Request payload:

```json
{ "reason": "Employee access revoked" }
```

```bash
curl -X POST "$BASE_URL/admin/users/$EMPLOYEE_ID/revoke-access" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Employee access revoked"}'
```

## Restore Employee Access

Request payload:

```json
{ "reason": "Access restored after review" }
```

```bash
curl -X POST "$BASE_URL/admin/users/$EMPLOYEE_ID/restore-access" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason":"Access restored after review"}'
```

## Download Spend Report

No request body. The response is an XLSX file.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE_URL/admin/reports/spends?month=2026-11" -o spends.xlsx
```

## Download Personnel Report

No request body. The response is an XLSX file.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE_URL/admin/reports/personnel?month=2026-11" -o personnel.xlsx
```

Reports filter claims by submission month. Personnel wallet due is current, and settled amount is filtered by settlement month. Spend report settlement details refer to the latest linked settlement.

## Get Push Public Key

No request body. The server must have `VAPID_PUBLIC_KEY` configured.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE_URL/admin/push/vapid-public-key"
```

## Save Push Subscription

Request payload:

```json
{
  "endpoint": "https://push-service.example/subscription",
  "keys": { "p256dh": "PUBLIC_KEY_VALUE", "auth": "AUTH_SECRET_VALUE" }
}
```

```bash
curl -X POST "$BASE_URL/admin/push/subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://push-service.example/subscription","keys":{"p256dh":"PUBLIC_KEY_VALUE","auth":"AUTH_SECRET_VALUE"}}'
```

The requested `GET` with the same body is also supported, but `POST` is recommended because many clients do not support GET request bodies. These APIs store subscriptions; notification delivery is not implemented.

## Delete Push Subscription

Request payload:

```json
{ "endpoint": "https://push-service.example/subscription" }
```

```bash
curl -X DELETE "$BASE_URL/admin/push/subscriptions" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://push-service.example/subscription"}'
```

## Get Current User

No request body.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/auth/me"
```

## Logout Current Session

No request body. This revokes the session associated with the access token.

```bash
curl -H "Authorization: Bearer $ACCESS_TOKEN" "$BASE_URL/auth/logout"
```
