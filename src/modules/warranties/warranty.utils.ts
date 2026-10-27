import { WarrantyStatus } from './enums/warranty-status.enum';

export enum WarrantyApiStatus {
  RECEIVED = 'received',
  CHECKING = 'checking',
  REPAIRING = 'repairing',
  COMPLETED = 'completed',
}

export const WARRANTY_STATUS_FLOW = [
  WarrantyStatus.RECEIVED,
  WarrantyStatus.CHECKING,
  WarrantyStatus.REPAIRING,
  WarrantyStatus.COMPLETED,
];

export function toDatabaseStatus(status: WarrantyApiStatus): WarrantyStatus {
  return WARRANTY_STATUS_FLOW[Object.values(WarrantyApiStatus).indexOf(status)];
}

export function toApiStatus(status: WarrantyStatus): WarrantyApiStatus {
  return Object.values(WarrantyApiStatus)[WARRANTY_STATUS_FLOW.indexOf(status)];
}

export function todayInVietnam(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Calendar months, clamping the day to the last day of the target month. */
export function warrantyExpiry(
  purchasedAt: string,
  months: number | null,
): string | null {
  if (months === null) return null;
  const [year, month, day] = purchasedAt.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function coverageStatus(
  product: {
    purchasedAt: string;
    expiresAt: string | null;
    warrantyMonths: number | null;
  },
  today = todayInVietnam(),
): 'active' | 'expired' | 'unknown' | 'not_covered' | 'not_started' {
  if (product.warrantyMonths === null || product.expiresAt === null)
    return 'unknown';
  if (product.warrantyMonths === 0) return 'not_covered';
  if (product.purchasedAt > today) return 'not_started';
  return product.expiresAt >= today ? 'active' : 'expired';
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'driverError' in error &&
    (error as { driverError?: { code?: string } }).driverError?.code === '23505'
  );
}
