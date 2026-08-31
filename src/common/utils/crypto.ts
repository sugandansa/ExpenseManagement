import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hashOtp(phone: string, otp: string, pepper: string): string {
  return sha256(`${pepper}:${phone}:${otp}`);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

export function publicCode(prefix: string, id: number): string {
  return `${prefix}_${id}`;
}

export function toNumber(value: { toString(): string } | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  return Number(value);
}
