import { Result, Ok, Err } from '../../../../shared/result/result';
import { InvalidStreamStatusError } from '../errors/streaming.errors';
import { StreamStatus } from '../entities/stream-session.entity';

export type StreamTransitionAction = 'START' | 'END' | 'KILL';

interface Transition {
  readonly from: readonly StreamStatus[];
  readonly to: StreamStatus;
  readonly label: string;
}

// KILL added in P8-06 for `POST /admin/streams/:id/kill` (05-API-SPEC.md §11) — unowned by any
// ticket. Legal from SCHEDULED (never went live, admin cancels it outright) or LIVE (force-end a
// live stream) — ENDED/CANCELLED stay terminal, same "terminal until a doc says otherwise"
// treatment as every other state machine in this build.
const TRANSITIONS: Record<StreamTransitionAction, Transition> = {
  START: { from: ['SCHEDULED'], to: 'LIVE', label: 'start the stream' },
  END: { from: ['LIVE'], to: 'ENDED', label: 'end the stream' },
  KILL: { from: ['SCHEDULED', 'LIVE'], to: 'CANCELLED', label: 'kill the stream' },
};

export function transitionStreamStatus(
  action: StreamTransitionAction,
  currentStatus: StreamStatus,
): Result<StreamStatus, InvalidStreamStatusError> {
  const transition = TRANSITIONS[action];

  if (!transition.from.includes(currentStatus)) {
    return Err(new InvalidStreamStatusError(transition.label, transition.from, currentStatus));
  }

  return Ok(transition.to);
}
