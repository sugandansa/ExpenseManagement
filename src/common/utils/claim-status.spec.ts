import { historyStatusWhere, normalizeClaimStatus } from './claim-status';

describe('claim-status helpers', () => {
  it('normalizes legacy statuses to product vocabulary', () => {
    expect(normalizeClaimStatus('tagged')).toBe('pending');
    expect(normalizeClaimStatus('submitted')).toBe('pending');
    expect(normalizeClaimStatus('settled')).toBe('paid');
    expect(normalizeClaimStatus('flagged')).toBe('flagged');
  });

  it('maps history filters for pending and paid', () => {
    expect(historyStatusWhere('pending')).toEqual({ in: ['pending', 'tagged', 'submitted'] });
    expect(historyStatusWhere('paid')).toEqual({ in: ['paid', 'settled'] });
    expect(historyStatusWhere('flagged')).toBe('flagged');
    expect(historyStatusWhere('all')).toBeUndefined();
  });
});
