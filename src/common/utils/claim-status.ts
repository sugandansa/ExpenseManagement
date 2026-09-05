/** Product claim statuses exposed to the employee app. */
export const CLAIM_STATUSES = ['pending', 'flagged', 'approved', 'paid'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/** Open (awaiting approval) statuses, including legacy values still in the DB. */
export const OPEN_CLAIM_STATUSES = ['submitted', 'tagged', 'pending', 'flagged'] as const;

/** Map legacy DB values to the 4 product statuses. */
export function normalizeClaimStatus(status: string): string {
  if (status === 'tagged' || status === 'submitted') return 'pending';
  if (status === 'settled') return 'paid';
  return status;
}

/** Build a Prisma status filter for employee history, accepting product + legacy names. */
export function historyStatusWhere(status?: string): { in: string[] } | string | undefined {
  if (!status || status === 'all') return undefined;
  switch (status) {
    case 'pending':
    case 'tagged':
    case 'submitted':
      return { in: ['pending', 'tagged', 'submitted'] };
    case 'paid':
    case 'settled':
      return { in: ['paid', 'settled'] };
    case 'flagged':
    case 'approved':
    case 'rejected':
      return status;
    default:
      return status;
  }
}
