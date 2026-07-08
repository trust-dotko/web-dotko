import { describe, it, expect } from 'vitest';
import {
  calculateTrustScore,
  getTradeAmount,
  isPaidResolved,
  isLatePartial,
  isDefault,
  resolveAppealState,
  appealDaysLeft,
  isDeadlinePassed,
  tierFromScore,
  getTierLabel,
  getScoreCaption,
  getBaseScoreNote,
  getRiskLevel,
} from './trustEngine';

// ── helpers ──────────────────────────────────────────────────────────────────
const daysFromNow = (n) => new Date(Date.now() + n * 86400000).toISOString();

// A fully-qualified business: Identity 20 + Age 20 + GST 20 + Transparency 20 = 80
const META_FULL = {
  name: 'Acme Traders',
  type: 'Private Limited',
  status: 'Active',
  registrationDate: '2018-01-01', // > 36 months old
  registeredAddress: '123 MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
};

describe('calculateTrustScore — pillar baseline (no trades)', () => {
  it('scores the 5 registration pillars, never a hardcoded 50', () => {
    const { score, factors, tier, critical } = calculateTrustScore([], {});
    // Age unknown (10) + GST unknown (10) = 20
    expect(score).toBe(20);
    expect(tier).toBe('risk');
    expect(critical).toBe(false);
    expect(factors).toHaveLength(5); // one per pillar
  });

  it('a fully-qualified business with no trades scores 80 (the "80" screenshot case)', () => {
    const { score, tier } = calculateTrustScore([], META_FULL);
    expect(score).toBe(80);
    expect(tier).toBe('safe');
  });

  it('adds the Verified-by-Dotko pillar to reach 100', () => {
    const { score } = calculateTrustScore([], { ...META_FULL, verifiedByDotko: true });
    expect(score).toBe(100);
  });

  it('returns null score and inactive tier for Cancelled/Inactive GST', () => {
    expect(calculateTrustScore([], { status: 'Cancelled' }).score).toBeNull();
    expect(calculateTrustScore([], { status: 'Inactive' }).tier).toBe('inactive');
  });

  it('handles null businessMeta and undefined trades gracefully', () => {
    expect(calculateTrustScore(undefined, null).score).toBe(20);
  });

  it('parses DD/MM/YYYY registration dates from the GST registry (not native Date)', () => {
    // Regression: new Date('15/05/2018') is Invalid Date (native parser guesses
    // MM/DD, and 15 isn't a month) — this silently docked Business Age to 0.
    // Real case: 24ABLFA7032N1Z8 scored 60 instead of 80 because of this.
    const day15 = { ...META_FULL, incorporated: '15/05/2018' }; // day > 12 broke native parsing
    const day01 = { ...META_FULL, incorporated: '01/07/2017' }; // day <= 12 "parsed" but as the wrong date
    expect(calculateTrustScore([], day15).score).toBe(80);
    expect(calculateTrustScore([], day01).score).toBe(80);
  });

  it('still scores an ISO-format incorporated date correctly', () => {
    expect(calculateTrustScore([], { ...META_FULL, incorporated: '2018-05-15' }).score).toBe(80);
  });

  it('treats an unparseable registration date as unknown (partial credit), not a crash', () => {
    const { score } = calculateTrustScore([], { ...META_FULL, incorporated: 'not-a-date' });
    expect(score).toBe(70); // 20 (Identity) + 10 (Age, unknown) + 20 + 20 = 70
  });
});

describe('calculateTrustScore — trade adjustments, appeals & Critical', () => {
  it('a confirmed (verified) default deducts and flags Critical', () => {
    const trades = [{ status: 'Default/Written Off', verificationStatus: 'verified' }];
    const { score, tier, critical } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(75); // 80 − 5
    expect(critical).toBe(true);
    expect(tier).toBe('critical');
  });

  it('HOLDS the penalty while an appeal is actively open (not expired)', () => {
    const trades = [{
      status: 'Default/Written Off',
      appealStatus: 'appealed',
      verificationDeadline: daysFromNow(3),
    }];
    const { score, tier, critical } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(80);     // penalty held → no deduction
    expect(critical).toBe(false);
    expect(tier).toBe('safe');
  });

  it('locks to Critical once the 7-day window expires unresolved', () => {
    const trades = [{
      status: 'Default/Written Off',
      appealStatus: 'open',
      verificationDeadline: daysFromNow(-1), // expired
    }];
    const { score, critical, tier } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(75);
    expect(critical).toBe(true);
    expect(tier).toBe('critical');
  });

  it('a settled default removes the penalty AND earns a positive bonus above baseline', () => {
    const trades = [{ status: 'Default/Written Off', appealStatus: 'settled' }];
    const { score, critical } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(85); // 80 baseline + 5 settled-dispute bonus (no lingering penalty)
    expect(critical).toBe(false);
  });

  it('settled-dispute bonus is capped at +15 even with many settlements', () => {
    const trades = Array(5).fill({ status: 'Default/Written Off', appealStatus: 'settled' });
    const { score } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(95); // 80 + min(5*5, 15) = 80 + 15
  });

  it('Paid on Time trades earn a capped bonus on top of the pillar baseline', () => {
    const trades = [{ status: 'Paid on Time' }, { status: 'Paid on Time' }];
    const { score } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(84); // 80 + min(2*2, 10) = 80 + 4
  });

  it('Paid-on-time bonus caps at +10 regardless of trade count', () => {
    const trades = Array(10).fill({ status: 'Paid on Time' });
    const { score } = calculateTrustScore(trades, META_FULL);
    expect(score).toBe(90); // 80 + min(10*2, 10) = 80 + 10
  });

  it('auto-flags to <=49 with 6+ fully-weighted negative trades', () => {
    const trades = Array(6).fill({ status: 'Default/Written Off', verificationStatus: 'verified' });
    const { score, autoFlagged, tier } = calculateTrustScore(trades, META_FULL);
    expect(score).toBeLessThanOrEqual(49);
    expect(autoFlagged).toBe(true);
    expect(tier).toBe('critical');
  });
});

describe('canonical accessors & classifiers', () => {
  it('getTradeAmount prefers tradeValue, falls back to legacy amount', () => {
    expect(getTradeAmount({ tradeValue: 5000 })).toBe(5000);
    expect(getTradeAmount({ amount: 1200 })).toBe(1200);
    expect(getTradeAmount({})).toBe(0);
  });

  it('status classifiers cover new and legacy statuses', () => {
    expect(isPaidResolved('Paid on Time')).toBe(true);
    expect(isPaidResolved('Paid')).toBe(true);
    expect(isLatePartial('Partially Paid')).toBe(true);
    expect(isDefault('Default/Written Off')).toBe(true);
    expect(isDefault('Unpaid')).toBe(true);
  });
});

describe('appeal state machine (derived-on-read)', () => {
  it('expired open/appealed windows collapse to unresolved_dispute', () => {
    expect(resolveAppealState({ appealStatus: 'open', verificationDeadline: daysFromNow(-1) })).toBe('unresolved_dispute');
    expect(resolveAppealState({ appealStatus: 'appealed', verificationDeadline: daysFromNow(-2) })).toBe('unresolved_dispute');
  });

  it('active windows stay open/appealed and report days left', () => {
    expect(resolveAppealState({ appealStatus: 'appealed', verificationDeadline: daysFromNow(2) })).toBe('appealed');
    expect(appealDaysLeft({ appealStatus: 'open', verificationDeadline: daysFromNow(3) })).toBe(3);
  });

  it('settled is terminal regardless of deadline', () => {
    expect(resolveAppealState({ appealStatus: 'settled', verificationDeadline: daysFromNow(-9) })).toBe('settled');
  });

  it('isDeadlinePassed handles ISO strings and Firestore Timestamps', () => {
    expect(isDeadlinePassed(daysFromNow(-1))).toBe(true);
    expect(isDeadlinePassed(daysFromNow(1))).toBe(false);
    expect(isDeadlinePassed({ toDate: () => new Date(Date.now() - 1000) })).toBe(true);
  });
});

describe('labels & captions', () => {
  it('tierFromScore maps thresholds', () => {
    expect(tierFromScore(80)).toBe('safe');
    expect(tierFromScore(50)).toBe('caution');
    expect(tierFromScore(10)).toBe('risk');
    expect(tierFromScore(null)).toBe('inactive');
  });

  it('getScoreCaption never double-words "Risk"', () => {
    expect(getScoreCaption('safe')).toBe('Trust Score · Low Risk · out of 100');
    expect(getScoreCaption('Low Risk')).toBe('Trust Score · Low Risk · out of 100');
    expect(getScoreCaption('critical')).toBe('Trust Score · Critical · out of 100');
  });

  it('getTierLabel and getRiskLevel stay backward compatible', () => {
    expect(getTierLabel('critical')).toBe('Critical');
    expect(getRiskLevel(85)).toBe('Low Risk');
  });

  it('getBaseScoreNote explains the no-trade-history state without a magic number', () => {
    expect(getBaseScoreNote(80)).toMatch(/no trade history/i);
    expect(getBaseScoreNote(80)).not.toMatch(/50/);
  });
});
