import { describe, expect, it } from 'vitest';
import { evaluateAntiSnipe, AntiSnipeConfig } from './anti-snipe.rule';

const CONFIG: AntiSnipeConfig = { windowSeconds: 10, extendBySeconds: 10, maxExtensions: 20 };

describe('evaluateAntiSnipe', () => {
  it('does not extend when well outside the window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:01:00.000Z'); // 60s remaining

    const decision = evaluateAntiSnipe(now, endsAt, 0, CONFIG);

    expect(decision.shouldExtend).toBe(false);
    expect(decision.newEndsAt).toEqual(endsAt);
  });

  it('extends when exactly at the window boundary (inclusive)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:10.000Z'); // exactly 10s remaining, window = 10

    const decision = evaluateAntiSnipe(now, endsAt, 0, CONFIG);

    expect(decision.shouldExtend).toBe(true);
  });

  it('does not extend just outside the window boundary', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:10.001Z'); // 10.001s remaining

    const decision = evaluateAntiSnipe(now, endsAt, 0, CONFIG);

    expect(decision.shouldExtend).toBe(false);
  });

  it('computes newEndsAt from now, not from the old endsAt — the critical anti-stacking rule', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:05.000Z'); // 5s remaining, within window

    const decision = evaluateAntiSnipe(now, endsAt, 0, CONFIG);

    // Correct: now + extendBySeconds. Bug would give endsAt + extendBySeconds (10s later, wrong).
    expect(decision.newEndsAt).toEqual(new Date('2026-01-01T00:00:10.000Z'));
  });

  it('allows extending right up to the cap (extensionCount < maxExtensions)', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:05.000Z');

    const decision = evaluateAntiSnipe(now, endsAt, 19, CONFIG);

    expect(decision.shouldExtend).toBe(true);
  });

  it('refuses to extend once the cap is reached, even within the window', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:05.000Z');

    const decision = evaluateAntiSnipe(now, endsAt, 20, CONFIG);

    expect(decision.shouldExtend).toBe(false);
    expect(decision.newEndsAt).toEqual(endsAt);
  });

  it('refuses to extend well past the cap', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:05.000Z');

    const decision = evaluateAntiSnipe(now, endsAt, 500, CONFIG);

    expect(decision.shouldExtend).toBe(false);
  });

  it('respects a custom config rather than hardcoded defaults', () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const endsAt = new Date('2026-01-01T00:00:03.000Z'); // 3s remaining

    const tightConfig: AntiSnipeConfig = { windowSeconds: 2, extendBySeconds: 5, maxExtensions: 1 };
    const decision = evaluateAntiSnipe(now, endsAt, 0, tightConfig);

    // 3s remaining > 2s window → no extension under this tighter config
    expect(decision.shouldExtend).toBe(false);
  });
});
