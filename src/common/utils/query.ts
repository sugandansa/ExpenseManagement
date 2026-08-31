export function monthRange(month?: string): { start: Date; end: Date } | null {
  if (!month) {
    return null;
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('INVALID_MONTH');
  }
  const start = new Date(`${month}-01T00:00:00.000Z`);
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return { start, end };
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function resolveMonth(month?: string): { start: Date; end: Date; month: string } {
  const value = month || currentMonth();
  const range = monthRange(value);
  if (!range) {
    throw new Error('INVALID_MONTH');
  }
  return { ...range, month: value };
}

export function paginateMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 0,
  };
}

export function normalizePage(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return {
    page: safePage,
    limit: safeLimit,
    skip: (safePage - 1) * safeLimit,
  };
}
