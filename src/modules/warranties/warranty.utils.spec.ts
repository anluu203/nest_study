import {
  coverageStatus,
  todayInVietnam,
  warrantyExpiry,
} from './warranty.utils';

describe('Warranty calendar rules', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2024-01-31', 1, '2024-02-29'],
    ['2024-02-29', 12, '2025-02-28'],
    ['2026-08-10', 36, '2029-08-10'],
    ['2026-10-28', 0, '2026-10-28'],
    ['2026-10-28', null, null],
  ])('adds calendar months to %s', (date, months, expected) => {
    expect(warrantyExpiry(date, months)).toBe(expected);
  });

  it('uses Vietnam dates across a UTC midnight boundary', () => {
    expect(todayInVietnam(new Date('2026-10-27T17:00:00Z'))).toBe('2026-10-28');
    expect(todayInVietnam(new Date('2026-10-27T16:59:59Z'))).toBe('2026-10-27');
  });

  it('covers the entire expiry day and distinguishes missing and zero-month coverage', () => {
    const product = {
      purchasedAt: '2025-10-28',
      expiresAt: '2026-10-28',
      warrantyMonths: 12,
    };
    expect(coverageStatus(product, '2026-10-28')).toBe('active');
    expect(coverageStatus(product, '2026-10-29')).toBe('expired');
    expect(coverageStatus(product, '2025-10-27')).toBe('not_started');
    expect(
      coverageStatus({ ...product, warrantyMonths: null }, '2026-10-28'),
    ).toBe('unknown');
    expect(
      coverageStatus({ ...product, warrantyMonths: 0 }, '2026-10-28'),
    ).toBe('not_covered');
  });
});
