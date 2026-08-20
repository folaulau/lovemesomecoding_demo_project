import { HumanisePipe, MoneyPipe } from './money.pipe';

/* ==========================================================================
 * ANGULAR CONCEPT: the test that needs no TestBed
 *
 * A pipe is a class with one method. Nothing about it needs Angular running, so the cheapest
 * correct test is `new MoneyPipe()` and a call — no TestBed, no fixture, no change detection,
 * milliseconds instead of tens of them.
 *
 * That is the rule worth taking from this file: reach for TestBed when you need Angular's
 * INJECTOR or its RENDERING, and not before. Most services and every pure pipe need neither.
 * ========================================================================== */
describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats a number as US currency', () => {
    expect(pipe.transform(14.5)).toBe('$14.50');
  });

  it('treats null and undefined as zero rather than printing "$NaN"', () => {
    // Both happen for real: an optional field on a DTO, and a total read before its request lands.
    expect(pipe.transform(null)).toBe('$0.00');
    expect(pipe.transform(undefined)).toBe('$0.00');
  });

  it('always shows two decimal places', () => {
    expect(pipe.transform(3)).toBe('$3.00');
  });
});

describe('HumanisePipe', () => {
  const pipe = new HumanisePipe();

  it('turns a SCREAMING_SNAKE enum into a sentence', () => {
    expect(pipe.transform('PENDING_PAYMENT')).toBe('Pending payment');
    expect(pipe.transform('SMALL')).toBe('Small');
  });

  it('returns an empty string for a missing value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
