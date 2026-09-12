/** Product claim statuses exposed to the employee app. */
export const CLAIM_STATUSES = ['pending', 'flagged', 'approved', 'partially_paid', 'paid'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Open (awaiting approval) statuses, including legacy values still in the DB. */
export const OPEN_CLAIM_STATUSES = ['submitted', 'tagged', 'pending', 'flagged'] as const;

/**
 * Closed = decision made (approved/rejected) and/or payment in progress/done.
 * Includes partially_paid so half-settled bills stay visible in Closed.
 */
export const CLOSED_CLAIM_STATUSES = ['approved', 'rejected', 'partially_paid', 'paid', 'settled'] as const;

/** Map legacy DB values to product statuses (admin keeps `flagged`). */
export function normalizeClaimStatus(status: string): string {
  if (status === 'tagged' || status === 'submitted') return 'pending';
  if (status === 'settled') return 'paid';
  return status;
}

/**
 * Employee-facing status. Over-budget claims stay `pending` in the app;
 * use `isOverBudget` for the warning — do not expose admin `flagged`.
 */
export function normalizeEmployeeClaimStatus(status: string): string {
  const normalized = normalizeClaimStatus(status);
  return normalized === 'flagged' ? 'pending' : normalized;
}

/**
 * Derive payment fields after allocating cash to a claim.
 * - unpaid (pending): paidAmount == 0
 * - partially_paid: 0 < paidAmount < amount
 * - paid: paidAmount >= amount
 */
export function paymentStateForAmounts(
  claimAmount: number,
  paidAmount: number,
): {
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: 'pending' | 'partially_paid' | 'paid';
  status: 'approved' | 'partially_paid' | 'paid';
} {
  const amount = Number(claimAmount.toFixed(2));
  const paid = Number(Math.min(Math.max(0, paidAmount), amount).toFixed(2));
  const remaining = Number((amount - paid).toFixed(2));
  if (paid <= 0) {
    return { paidAmount: 0, remainingAmount: amount, paymentStatus: 'pending', status: 'approved' };
  }
  if (remaining > 0.001) {
    return {
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus: 'partially_paid',
      status: 'partially_paid',
    };
  }
  return { paidAmount: amount, remainingAmount: 0, paymentStatus: 'paid', status: 'paid' };
}

/** Build a Prisma status filter for employee history, accepting product + legacy names. */
export function historyStatusWhere(status?: string): { in: string[] } | string | undefined {
  if (!status || status === 'all') return undefined;
  switch (status) {
    case 'pending':
    case 'tagged':
    case 'submitted':
      return { in: ['pending', 'tagged', 'submitted', 'flagged'] };
    case 'paid':
    case 'settled':
      return { in: ['paid', 'settled'] };
    case 'partially_paid':
      return 'partially_paid';
    case 'flagged':
    case 'approved':
    case 'rejected':
      return status;
    default:
      return status;
  }
}
