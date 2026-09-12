import { buildClaimTimeline } from './claim-timeline';

describe('buildClaimTimeline', () => {
  const base = {
    status: 'pending',
    approvalStatus: 'pending',
    paymentStatus: 'pending',
    submissionDate: new Date('2026-09-09T06:21:49.000Z'),
    createdAt: new Date('2026-09-09T06:21:50.422Z'),
    approvedAt: null as Date | null,
    approvalComment: null as string | null,
    rejectionReason: null as string | null,
    events: [] as { status: string; note: string | null; createdAt: Date }[],
    settlement: null as {
      paymentMode: string;
      reference: string | null;
      settledAt: Date;
    } | null,
  };

  it('shows submitted and owner_review while pending', () => {
    const timeline = buildClaimTimeline({
      ...base,
      events: [
        {
          status: 'pending',
          note: 'Expense submitted',
          createdAt: new Date('2026-09-09T06:21:50.422Z'),
        },
      ],
    });
    expect(timeline).toEqual([
      {
        status: 'submitted',
        note: 'Expense submitted',
        at: new Date('2026-09-09T06:21:50.422Z'),
      },
      {
        status: 'owner_review',
        note: 'Under review by owner',
        at: new Date('2026-09-09T06:21:50.422Z'),
      },
    ]);
  });

  it('adds approved after owner review', () => {
    const timeline = buildClaimTimeline({
      ...base,
      status: 'approved',
      approvalStatus: 'approved',
      approvedAt: new Date('2026-09-09T06:22:05.631Z'),
      events: [
        {
          status: 'submitted',
          note: 'Expense submitted',
          createdAt: new Date('2026-09-09T06:21:50.422Z'),
        },
        {
          status: 'approved',
          note: 'Claim approved',
          createdAt: new Date('2026-09-09T06:22:05.631Z'),
        },
      ],
    });
    expect(timeline.map((item) => item.status)).toEqual(['submitted', 'owner_review', 'approved']);
    expect(timeline[2]).toMatchObject({
      status: 'approved',
      note: 'Claim approved',
      at: new Date('2026-09-09T06:22:05.631Z'),
    });
  });

  it('adds paid with payment method from settlement', () => {
    const timeline = buildClaimTimeline({
      ...base,
      status: 'paid',
      approvalStatus: 'approved',
      paymentStatus: 'paid',
      amount: 100,
      paidAmount: 100,
      approvedAt: new Date('2026-09-09T06:22:05.631Z'),
      events: [
        {
          status: 'submitted',
          note: 'Expense submitted',
          createdAt: new Date('2026-09-09T06:21:50.422Z'),
        },
        {
          status: 'approved',
          note: 'Claim approved',
          createdAt: new Date('2026-09-09T06:22:05.631Z'),
        },
      ],
      settlement: {
        paymentMode: 'UPI',
        reference: null,
        settledAt: new Date('2026-09-09T07:15:30.000Z'),
      },
    });
    expect(timeline.map((item) => item.status)).toEqual(['submitted', 'owner_review', 'approved', 'paid']);
    expect(timeline[3]).toMatchObject({
      status: 'paid',
      note: 'Paid via UPI',
      paidAmount: 100,
      amount: 100,
    });
  });

  it('shows partially_paid with paidAmount when only part is settled', () => {
    const timeline = buildClaimTimeline({
      ...base,
      status: 'partially_paid',
      approvalStatus: 'approved',
      paymentStatus: 'partially_paid',
      amount: 100,
      paidAmount: 50,
      approvedAt: new Date('2026-09-09T13:50:52.133Z'),
      events: [
        {
          status: 'submitted',
          note: 'Expense submitted',
          createdAt: new Date('2026-09-09T13:49:53.467Z'),
        },
        {
          status: 'approved',
          note: 'Bulk approve',
          createdAt: new Date('2026-09-09T13:50:52.133Z'),
        },
        {
          status: 'partially_paid',
          note: 'Partially paid 50 of 100 via UPI (Ref: tesrt)',
          createdAt: new Date('2026-09-09T13:58:17.800Z'),
        },
      ],
      settlement: {
        paymentMode: 'UPI',
        reference: 'tesrt',
        settledAt: new Date('2026-09-09T13:58:17.800Z'),
      },
    });
    expect(timeline.map((item) => item.status)).toEqual(['submitted', 'owner_review', 'approved', 'partially_paid']);
    expect(timeline[3]).toMatchObject({
      status: 'partially_paid',
      note: 'Partially paid 50 of 100 via UPI (Ref: tesrt)',
      paidAmount: 50,
      amount: 100,
    });
  });

  it('maps legacy approve-as-paid event into approved + paid', () => {
    const timeline = buildClaimTimeline({
      ...base,
      status: 'paid',
      approvalStatus: 'approved',
      paymentStatus: 'paid',
      amount: 60,
      paidAmount: 60,
      approvedAt: new Date('2026-09-09T06:29:49.252Z'),
      events: [
        {
          status: 'pending',
          note: 'Expense submitted',
          createdAt: new Date('2026-09-09T06:29:42.643Z'),
        },
        {
          status: 'paid',
          note: 'Claim approved and paid to wallet',
          createdAt: new Date('2026-09-09T06:29:49.252Z'),
        },
      ],
    });
    expect(timeline.map((item) => ({ status: item.status, note: item.note }))).toEqual([
      { status: 'submitted', note: 'Expense submitted' },
      { status: 'owner_review', note: 'Under review by owner' },
      { status: 'approved', note: 'Claim approved' },
      { status: 'paid', note: 'Paid to wallet' },
    ]);
  });
});
