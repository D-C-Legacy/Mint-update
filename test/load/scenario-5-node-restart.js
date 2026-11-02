// 06-REALTIME-AND-CONCURRENCY.md §12, row 5: "Node restart under load" ->
// "Clients reconnect within 5s, state correct after snapshot."
//
// Run: k6 run -e DURATION_SECONDS=90 test/load/scenario-5-node-restart.js, and, partway through
// the run, actually restart the realtime process — kill and re-launch the real `main.realtime.ts`
// process (or, against real staging, whatever that environment's own restart mechanism is: a
// pod restart, a PM2/systemd restart, a redeploy). This script deliberately does NOT trigger
// that restart itself: no ticket anywhere in this build provisions a staging deployment
// mechanism to call (flagged in PROGRESS.md/MEMORY.md for P9-05), and locally the 3 processes
// aren't containerized either (docker-compose.yml only has Postgres/Redis/MinIO) — there is no
// single "restart the node" primitive this script could reach for that would also be correct
// against a real target environment. What IS this script's job: measure client-side reconnect
// behavior whenever the connection drops, restart-triggered or not. Run
// `npx ts-node test/load/seed.ts` first.
//
// Each VU joins the room, then loops: if its socket closes for any reason other than its own
// end-of-test close, it immediately starts retrying `ws.connect` (fixed short backoff) until a
// new connection authenticates and a fresh `room.join` gets back a `room.state` snapshot —
// timestamped from the moment of disconnect to that snapshot's arrival. "State correct after
// snapshot" is checked directly: the re-join's `room.state` must still name the same session,
// still LIVE.
//
// Verified live: killed and restarted the real `main.realtime.ts` process mid-run several
// times. The reconnect mechanism itself is correct every time — backoff, reconnect, re-join,
// correct snapshot, all proven (`reconnect_state_mismatch` stayed 0 throughout). The `<5000ms`
// threshold itself did NOT hold locally — restarting via `ts-node` (recompiles the whole app
// from TypeScript on every boot, the launcher this entire build's dev/verify ritual has always
// used) took anywhere from ~5s to ~19s across repeated trials on this one dev laptop, before the
// reconnect loop even gets a live server to reconnect to. A real deployment restarting
// precompiled JS (`node dist/main.realtime.js`) behind a fast rolling-restart mechanism would be
// a fundamentally different, much faster number — this is a property of the local dev launcher,
// not evidence the real target is unreachable. Flagged in PROGRESS.md/MEMORY.md, not silently
// passed.
import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { socketIoUrl, attachSocketIo } from './lib/socketio.js';
import { realtimeWsUrl, loadFixtures } from './lib/config.js';

const fixtures = loadFixtures();
const room = fixtures.rooms[0];

const VUS = Number(__ENV.VUS || 10);
const DURATION_SECONDS = Number(__ENV.DURATION_SECONDS || 90);
const RECONNECT_BACKOFF_MS = 250;

export const options = {
  scenarios: {
    viewers: { executor: 'constant-vus', vus: VUS, duration: `${DURATION_SECONDS}s` },
  },
  thresholds: {
    reconnect_ms: ['max<5000'],
    reconnect_state_mismatch: ['count==0'],
    ws_connect_errors: ['count==0'],
  },
};

const reconnectMs = new Trend('reconnect_ms');
const reconnectStateMismatch = new Counter('reconnect_state_mismatch');
const wsConnectErrors = new Counter('ws_connect_errors');

export default function () {
  const vuIndex = __VU - 1;
  const buyer = fixtures.buyers[vuIndex % fixtures.buyers.length];
  const vuDeadline = Date.now() + DURATION_SECONDS * 1000;

  let disconnectedAt = null; // set on an unintentional close, cleared once reconnect proves out
  let firstConnectErrored = false;

  while (true) {
    // k6's `socket.setTimeout` throws (`GoError: setTimeout requires a >0 timeout parameter`)
    // on a zero or negative delay — found live: once `Date.now()` reached `vuDeadline` exactly
    // at a loop boundary, `Math.max(0, vuDeadline - Date.now())` clamped to 0, the thrown error
    // aborted the whole iteration, and k6's `constant-vus` executor immediately started a BRAND
    // NEW iteration — which recomputes a brand new `vuDeadline` from scratch and promptly hits
    // the exact same zero-delay condition again, crash-looping for the remainder of the test
    // (355 "sessions" for 5 VUs over a 40s run, not the ~6 a real reconnect scenario produces).
    // Guarding here, before ever calling `ws.connect`, is what actually stops the loop in time.
    const remainingMs = vuDeadline - Date.now();
    if (remainingMs <= 0) {
      break;
    }

    let intentionalClose = false;

    const res = ws.connect(socketIoUrl(realtimeWsUrl), {}, function (socket) {
      const sio = attachSocketIo(socket, buyer.token, {
        onOpen: function () {
          sio.emit('room.join', { sessionId: room.sessionId });
        },
        onEvent: function (name, data) {
          if (name !== 'room.state') return;

          if (disconnectedAt !== null) {
            reconnectMs.add(Date.now() - disconnectedAt);
            disconnectedAt = null;
          }
          if (data.session.id !== room.sessionId || data.session.status !== 'LIVE') {
            reconnectStateMismatch.add(1);
          }
        },
        onClose: function () {
          if (!intentionalClose && disconnectedAt === null) {
            disconnectedAt = Date.now();
          }
        },
      });

      socket.setInterval(function () {
        sio.emit('heartbeat', { sessionId: room.sessionId });
      }, 15000);

      socket.setTimeout(function () {
        intentionalClose = true;
        socket.close();
      }, remainingMs);
    });

    if (!res || res.status !== 101) {
      firstConnectErrored = firstConnectErrored || disconnectedAt === null;
      if (disconnectedAt === null) {
        disconnectedAt = Date.now();
      }
      sleep(RECONNECT_BACKOFF_MS / 1000);
    }
  }

  check(null, { 'connected at least once': () => !firstConnectErrored }) || wsConnectErrors.add(1);
}
