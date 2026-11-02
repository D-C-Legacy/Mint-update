import { describe, expect, it } from 'vitest';
import { transitionStreamStatus, StreamTransitionAction } from './stream-status-transition.rule';
import { StreamStatus } from '../entities/stream-session.entity';

const ALL_STATUSES: readonly StreamStatus[] = ['SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'];

describe('transitionStreamStatus', () => {
  const transitions: ReadonlyArray<{
    action: StreamTransitionAction;
    from: readonly StreamStatus[];
    to: StreamStatus;
  }> = [
    { action: 'START', from: ['SCHEDULED'], to: 'LIVE' },
    { action: 'END', from: ['LIVE'], to: 'ENDED' },
    { action: 'KILL', from: ['SCHEDULED', 'LIVE'], to: 'CANCELLED' },
  ];

  for (const { action, from, to } of transitions) {
    it(`allows ${action} from each of [${from.join(', ')}] to ${to}`, () => {
      for (const status of from) {
        const result = transitionStreamStatus(action, status);
        expect(result.ok).toBe(true);
        expect(result.ok && result.value).toBe(to);
      }
    });

    it(`rejects ${action} from every status not in [${from.join(', ')}]`, () => {
      for (const status of ALL_STATUSES) {
        if (from.includes(status)) continue;

        const result = transitionStreamStatus(action, status);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('INVALID_STREAM_STATUS');
          expect(result.error.details).toEqual({ expected: from, actual: status });
        }
      }
    });
  }

  it('ENDED and CANCELLED have no legal outbound transition', () => {
    const terminalStatuses: readonly StreamStatus[] = ['ENDED', 'CANCELLED'];
    const allActions = transitions.map((t) => t.action);

    for (const status of terminalStatuses) {
      for (const action of allActions) {
        const result = transitionStreamStatus(action, status);
        expect(result.ok).toBe(false);
      }
    }
  });
});
