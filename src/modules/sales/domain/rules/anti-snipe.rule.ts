export interface AntiSnipeConfig {
  readonly windowSeconds: number;
  readonly extendBySeconds: number;
  readonly maxExtensions: number;
}

export interface AntiSnipeDecision {
  readonly shouldExtend: boolean;
  readonly newEndsAt: Date;
}

export function evaluateAntiSnipe(
  now: Date,
  endsAt: Date,
  extensionCount: number,
  config: AntiSnipeConfig,
): AntiSnipeDecision {
  const secondsRemaining = (endsAt.getTime() - now.getTime()) / 1000;
  const withinWindow = secondsRemaining <= config.windowSeconds;
  const shouldExtend = withinWindow && extensionCount < config.maxExtensions;

  // newEndsAt is always computed from `now`, never from the old `endsAt` — otherwise late
  // bids stack extensions on top of each other and the auction never actually ends.
  return {
    shouldExtend,
    newEndsAt: shouldExtend ? new Date(now.getTime() + config.extendBySeconds * 1000) : endsAt,
  };
}
