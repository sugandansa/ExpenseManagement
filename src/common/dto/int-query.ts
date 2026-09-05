import { Transform } from 'class-transformer';

export function toIntQuery(value: unknown, fallback?: number): number | undefined {
  const raw = Array.isArray(value) ? value[value.length - 1] : value;
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const IntQuery = (fallback?: number) =>
  Transform(({ value }) => toIntQuery(value, fallback));
