export type ClaimTimelineItem = {
  status: string;
  note: string | null;
  at: Date;
  /** Settled amount for this payment step (partial or full). */
  paidAmount?: number | null;
  /** Full claim amount (useful with partially_paid). */
  amount?: number | null;
};

type ClaimEventLike = {
  status: string;
  note: string | null;
  createdAt: Date;
};

type SettlementLike =
  | {
      paymentMode: string;
      reference: string | null;
      settledAt: Date;
    }
  | null
  | undefined;

export type ClaimTimelineSource = {
  status: string;
  approvalStatus: string;
  paymentStatus: string;
  submissionDate: Date;
  createdAt: Date;
  approvedAt: Date | null;
  approvalComment: string | null;
  rejectionReason: string | null;
  amount?: number | { toString(): string } | null;
  paidAmount?: number | { toString(): string } | null;
  events: ClaimEventLike[];
  settlement?: SettlementLike;
};

function toNum(value: number | { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : Number(value.toString());
}

function isSubmitEvent(event: ClaimEventLike): boolean {
  if (['pending', 'submitted', 'flagged', 'tagged'].includes(event.status)) return true;
  return /submitted/i.test(event.note ?? '');
}

function isApproveEvent(event: ClaimEventLike): boolean {
  if (event.status === 'approved') return true;
  // Legacy approve wrote status=paid with an "approved" note
  return event.status === 'paid' && /approv/i.test(event.note ?? '');
}

function isRejectEvent(event: ClaimEventLike): boolean {
  return event.status === 'rejected';
}

function isPartialPaidEvent(event: ClaimEventLike): boolean {
  return event.status === 'partially_paid' || /partially paid/i.test(event.note ?? '');
}

function isFullyPaidEvent(event: ClaimEventLike): boolean {
  if (event.status === 'settled') return true;
  if (event.status === 'partially_paid') return false;
  if (event.status !== 'paid') return false;
  return !/approv/i.test(event.note ?? '');
}

function paidNote(paymentMode?: string | null, reference?: string | null, fallback?: string | null): string {
  const mode = paymentMode?.trim();
  if (mode) {
    const base = `Paid via ${mode}`;
    const ref = reference?.trim();
    return ref ? `${base} (Ref: ${ref})` : base;
  }
  if (fallback?.trim()) return fallback.trim();
  return 'Paid to wallet';
}

function partialPaidNote(
  paidAmount: number,
  claimAmount: number,
  paymentMode?: string | null,
  reference?: string | null,
  fallback?: string | null,
): string {
  if (fallback?.trim() && /partially paid/i.test(fallback)) return fallback.trim();
  const mode = paymentMode?.trim();
  const ref = reference?.trim();
  const via = mode ? (ref ? ` via ${mode} (Ref: ${ref})` : ` via ${mode}`) : '';
  return `Partially paid ${paidAmount} of ${claimAmount}${via}`;
}

/**
 * Employee/admin claim timeline: submitted → owner_review → approved|rejected → partially_paid|paid.
 * Synthesizes owner_review and backfills paid details from settlement when present.
 */
export function buildClaimTimeline(claim: ClaimTimelineSource): ClaimTimelineItem[] {
  const events = [...claim.events].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const timeline: ClaimTimelineItem[] = [];
  const claimAmount = toNum(claim.amount);
  const paidAmount = toNum(claim.paidAmount);

  const submitEvent = events.find(isSubmitEvent);
  const submittedAt = submitEvent?.createdAt ?? claim.createdAt ?? claim.submissionDate;
  timeline.push({
    status: 'submitted',
    note: submitEvent?.note ?? 'Expense submitted',
    at: submittedAt,
  });

  timeline.push({
    status: 'owner_review',
    note: 'Under review by owner',
    at: submittedAt,
  });

  const rejected = claim.approvalStatus === 'rejected' || claim.status === 'rejected' || events.some(isRejectEvent);
  if (rejected) {
    const rejectEvent = events.find(isRejectEvent);
    timeline.push({
      status: 'rejected',
      note: rejectEvent?.note ?? claim.rejectionReason ?? 'Claim rejected',
      at: rejectEvent?.createdAt ?? claim.approvedAt ?? submittedAt,
    });
    return timeline;
  }

  const approved =
    claim.approvalStatus === 'approved' ||
    ['approved', 'partially_paid', 'paid', 'settled'].includes(claim.status) ||
    events.some(isApproveEvent);
  if (!approved) return timeline;

  const approveEvent = events.find(isApproveEvent);
  const approvedNote =
    claim.approvalComment?.trim() ||
    (approveEvent?.note && !/paid to wallet/i.test(approveEvent.note)
      ? approveEvent.note.replace(/\s+and paid to wallet$/i, '')
      : null) ||
    'Claim approved';
  timeline.push({
    status: 'approved',
    note: approvedNote,
    at: claim.approvedAt ?? approveEvent?.createdAt ?? submittedAt,
  });

  const settlement = claim.settlement ?? null;
  const partialEvent = events.filter(isPartialPaidEvent).at(-1);
  const paidEvent = events.filter(isFullyPaidEvent).at(-1);

  const isFullyPaid =
    claim.paymentStatus === 'paid' ||
    claim.status === 'paid' ||
    claim.status === 'settled' ||
    (paidAmount > 0 && claimAmount > 0 && paidAmount + 0.001 >= claimAmount);

  const isPartiallyPaid =
    !isFullyPaid &&
    (claim.paymentStatus === 'partially_paid' ||
      claim.status === 'partially_paid' ||
      paidAmount > 0 ||
      Boolean(partialEvent));

  if (isPartiallyPaid) {
    const amountForNote = claimAmount || paidAmount;
    const paidForNote = paidAmount || amountForNote;
    timeline.push({
      status: 'partially_paid',
      note: partialPaidNote(
        paidForNote,
        amountForNote,
        settlement?.paymentMode,
        settlement?.reference,
        partialEvent?.note,
      ),
      at: partialEvent?.createdAt ?? settlement?.settledAt ?? claim.approvedAt ?? submittedAt,
      paidAmount: paidForNote,
      amount: amountForNote || null,
    });
    return timeline;
  }

  if (!isFullyPaid && !paidEvent && !settlement) return timeline;

  // Fully paid — only show paid after approval (settlement link alone is not enough if still partial)
  if (isFullyPaid || Boolean(paidEvent)) {
    timeline.push({
      status: 'paid',
      note: paidNote(settlement?.paymentMode, settlement?.reference, paidEvent?.note),
      at: settlement?.settledAt ?? paidEvent?.createdAt ?? claim.approvedAt ?? submittedAt,
      paidAmount: claimAmount || paidAmount || null,
      amount: claimAmount || null,
    });
  }

  return timeline;
}
