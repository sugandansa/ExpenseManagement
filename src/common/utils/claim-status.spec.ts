import {
  historyStatusWhere,
  normalizeClaimStatus,
  normalizeEmployeeClaimStatus,
  paymentStateForAmounts,
} from './claim-status';

describe('claim-status helpers', () => {
  it('normalizes legacy statuses to product vocabulary', () => {
    expect(normalizeClaimStatus('tagged')).toBe('pending');
    expect(normalizeClaimStatus('submitted')).toBe('pending');
    expect(normalizeClaimStatus('settled')).toBe('paid');
    expect(normalizeClaimStatus('flagged')).toBe('flagged');
  });

  it('maps flagged to pending for employee-facing APIs', () => {
    expect(normalizeEmployeeClaimStatus('flagged')).toBe('pending');
    expect(normalizeEmployeeClaimStatus('tagged')).toBe('pending');
    expect(normalizeEmployeeClaimStatus('approved')).toBe('approved');
  });

  it('maps history filters for pending and paid', () => {
    expect(historyStatusWhere('pending')).toEqual({ in: ['pending', 'tagged', 'submitted', 'flagged'] });
    expect(historyStatusWhere('paid')).toEqual({ in: ['paid', 'settled'] });
    expect(historyStatusWhere('partially_paid')).toBe('partially_paid');
    expect(historyStatusWhere('flagged')).toBe('flagged');
    expect(historyStatusWhere('all')).toBeUndefined();
  });

  it('derives unpaid / partially_paid / paid from amounts', () => {
    expect(paymentStateForAmounts(100, 0)).toEqual({
      paidAmount: 0,
      remainingAmount: 100,
      paymentStatus: 'pending',
      status: 'approved',
    });
    expect(paymentStateForAmounts(100, 40)).toEqual({
      paidAmount: 40,
      remainingAmount: 60,
      paymentStatus: 'partially_paid',
      status: 'partially_paid',
    });
    expect(paymentStateForAmounts(100, 100)).toEqual({
      paidAmount: 100,
      remainingAmount: 0,
      paymentStatus: 'paid',
      status: 'paid',
    });
  });
});
