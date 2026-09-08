/** Product claim statuses exposed to the employee app. */
export const CLAIM_STATUSES = ['pending', 'flagged', 'approved', 'paid'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Open (awaiting approval) statuses, including legacy values still in the DB. */
export const OPEN_CLAIM_STATUSES = ['submitted', 'tagged', 'pending', 'flagged'] as const;

/** Closed (decision made / settled) statuses, including legacy `settled`. */
export const CLOSED_CLAIM_STATUSES = ['approved', 'rejected', 'paid', 'settled'] as const;

/** Map legacy DB values to the 4 product statuses (admin keeps `flagged`). */
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

/** Build a Prisma status filter for employee history, accepting product + legacy names. */
export function historyStatusWhere(status?: string): { in: string[] } | string | undefined {
  if (!status || status === 'all') return undefined;
  switch (status) {
    case 'pending':
    case 'tagged':
    case 'submitted':
      // Include flagged: still awaiting approval (over-budget), shown as pending to employees
      return { in: ['pending', 'tagged', 'submitted', 'flagged'] };
    case 'paid':
    case 'settled':
      return { in: ['paid', 'settled'] };
    case 'flagged':
      return 'flagged';
    case 'approved':
    case 'rejected':
      return status;
    default:
      return status;
  }
}
