import { describe, it, expect } from 'vitest';
import { calculateTrustScore } from './trustEngine';

describe('calculateTrustScore', () => {
  // ── No-trades baseline ──────────────────────────────────────────────────────

  it('returns score 50 and no factors when trades array is empty', () => {
    const result = calculateTrustScore([], {});
    expect(result.score).toBe(50);
    expect(result.factors).toEqual([]);
  });

  it('caps score at 30 for Cancelled GST even with zero trades', () => {
    const { score, factors } = calculateTrustScore([], { status: 'Cancelled' });
    expect(score).toBe(30);
    expect(factors.find(f => f.label.includes('Cancelled'))).toBeTruthy();
  });

  it('caps score at 30 for Inactive GST even with zero trades', () => {
    const { score } = calculateTrustScore([], { status: 'Inactive' });
    expect(score).toBe(30);
  });

  it('applies new-business penalty to 0-trade baseline (50 − 20 = 30)', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const { score, factors } = calculateTrustScore([], {
      registrationDate: tenDaysAgo.toISOString().split('T')[0],
    });
    expect(score).toBe(30);
    expect(factors.find(f => f.label.includes('New Business'))).toBeTruthy();
  });

  // ── Legacy statuses (backward compat) ──────────────────────────────────────

  it('returns score 100 when all trades are Paid on time', () => {
    const trades = [
      { status: 'Paid', creditDays: 30, actualDays: 28 },
      { status: 'Paid', creditDays: 45, actualDays: 44 },
    ];
    const { score, factors } = calculateTrustScore(trades, {});
    expect(score).toBe(100);
    expect(factors.find(f => f.label === 'Base score')).toBeTruthy();
  });

  it('deducts 20 per Unpaid trade', () => {
    const trades = [
      { status: 'Unpaid', creditDays: 30, actualDays: 30 },
      { status: 'Unpaid', creditDays: 30, actualDays: 30 },
    ];
    const { score, factors } = calculateTrustScore(trades, {});
    expect(score).toBe(60);
    expect(factors.find(f => f.delta === -40)).toBeTruthy();
  });

  it('deducts 10 per Delayed trade', () => {
    const trades = [{ status: 'Delayed', creditDays: 30, actualDays: 30 }];
    const { score, factors } = calculateTrustScore(trades, {});
    expect(score).toBe(90);
    expect(factors.find(f => f.delta === -10)).toBeTruthy();
  });

  it('deducts 5 per paid-but-late trade (Paid with actualDays > creditDays)', () => {
    const trades = [{ status: 'Paid', creditDays: 30, actualDays: 35 }];
    const { score, factors } = calculateTrustScore(trades, {});
    expect(score).toBe(95);
    expect(factors.find(f => f.delta === -5)).toBeTruthy();
  });

  // ── New lifecycle statuses ──────────────────────────────────────────────────

  it('deducts 30 per Default/Written Off trade', () => {
    const trades = [{ status: 'Default/Written Off' }];
    const { score, factors } = calculateTrustScore(trades, {});
    expect(score).toBe(70);
    expect(factors.find(f => f.label.includes('Default/Written Off'))).toBeTruthy();
  });

  it('deducts 15 per Partially Paid trade', () => {
    const trades = [{ status: 'Partially Paid' }];
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(85);
  });

  it('deducts 10 per Disputed trade', () => {
    const trades = [{ status: 'Disputed' }];
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(90);
  });

  it('deducts 5 per Paid Late trade', () => {
    const trades = [{ status: 'Paid Late' }];
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(95);
  });

  it('deducts 5 per Still Pending trade', () => {
    const trades = [{ status: 'Still Pending' }];
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(95);
  });

  it('Paid on Time trades score 100 (no deduction)', () => {
    const trades = [{ status: 'Paid on Time' }, { status: 'Paid on Time' }];
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(100);
  });

  // ── GST status cap ──────────────────────────────────────────────────────────

  it('caps score at 30 for Cancelled GST status (with trades)', () => {
    const { score, factors } = calculateTrustScore(
      [{ status: 'Paid', creditDays: 30, actualDays: 28 }],
      { status: 'Cancelled' }
    );
    expect(score).toBe(30);
    expect(factors.find(f => f.color === 'red' && f.label.includes('Cancelled'))).toBeTruthy();
  });

  it('caps score at 30 for Inactive GST status', () => {
    const { score } = calculateTrustScore(
      [{ status: 'Paid', creditDays: 30, actualDays: 28 }],
      { status: 'Inactive' }
    );
    expect(score).toBe(30);
  });

  it('shows GST cap factor with delta=null when cap actively reduced score', () => {
    const { factors } = calculateTrustScore(
      [{ status: 'Paid', creditDays: 30, actualDays: 28 }],
      { status: 'Cancelled' }
    );
    const capFactor = factors.find(f => f.label.includes('Cancelled'));
    expect(capFactor.delta).toBeNull();
  });

  it('shows GST cap factor with delta=0 when score is already below 30', () => {
    // 100 − 20×4 = 20 → already below 30, cap has no numeric effect
    const trades = Array(4).fill({ status: 'Unpaid', creditDays: 30, actualDays: 30 });
    const { score, factors } = calculateTrustScore(trades, { status: 'Cancelled' });
    expect(score).toBe(20);
    const capFactor = factors.find(f => f.label.includes('Cancelled'));
    expect(capFactor.delta).toBe(0);
  });

  // ── New-business penalty ────────────────────────────────────────────────────

  it('applies -20 penalty for business registered < 30 days ago', () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const regDate = tenDaysAgo.toISOString().split('T')[0];
    const { score, factors } = calculateTrustScore(
      [{ status: 'Paid', creditDays: 30, actualDays: 28 }],
      { registrationDate: regDate }
    );
    expect(score).toBe(80);
    expect(factors.find(f => f.label.includes('New Business'))).toBeTruthy();
  });

  it('does not apply new-business penalty for business registered >= 30 days ago', () => {
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
    const regDate = fortyDaysAgo.toISOString().split('T')[0];
    const { score, factors } = calculateTrustScore(
      [{ status: 'Paid', creditDays: 30, actualDays: 28 }],
      { registrationDate: regDate }
    );
    expect(score).toBe(100);
    expect(factors.find(f => f.label.includes('New Business'))).toBeFalsy();
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('floors score at 0', () => {
    const trades = Array(10).fill({ status: 'Unpaid', creditDays: 30, actualDays: 30 });
    const { score } = calculateTrustScore(trades, {});
    expect(score).toBe(0);
  });

  it('handles null businessMeta gracefully', () => {
    const { score } = calculateTrustScore([], null);
    expect(score).toBe(50);
  });

  it('handles undefined trades gracefully', () => {
    const { score } = calculateTrustScore(undefined, {});
    expect(score).toBe(50);
  });
});
