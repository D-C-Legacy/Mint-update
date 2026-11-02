// 06-REALTIME-AND-CONCURRENCY.md §12, row 2: "200 concurrent rooms, 100 viewers each" ->
// "Stable memory, no connection drops."
//
// Run against real staging/infra at the documented scale (seed with that many rooms first):
//   LOAD_TEST_ROOMS=200 npx ts-node test/load/seed.ts
//   k6 run -e VUS=20000 test/load/scenario-2-concurrent-rooms.js
// Defaults below are a local smoke scale (same caveat as scenario 1 — no staging exists yet to
// run the literal 200x100 number against). VUs distribute round-robin across however many rooms
// `fixtures.json` actually has, so this script works unchanged at either scale.
//
// "No connection drops" is measured directly (every VU's socket must stay open and keep
// receiving its own heartbeat's `viewers.count` echo for the whole run). "Stable memory" is not
// something a WS client can assert on its own — this script additionally samples the realtime
// process's own `/metrics` (`process_resident_memory_bytes`, exposed since P9-03) on a fixed
// interval throughout the run as a Trend, so a human can eyeball it for unbounded growth after
// the fact; there is no hard threshold on it, since no doc gives an acceptable growth curve.
import ws from 'k6/ws';
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { socketIoUrl, attachSocketIo } from './lib/socketio.js';
import { realtimeWsUrl, realtimeHttpUrl, loadFixtures } from './lib/config.js';

const fixtures = loadFixtures();

const VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || '90s';

export const options = {
  scenarios: {
    viewers: { executor: 'constant-vus', vus: VUS, duration: DURATION, gracefulStop: '5s' },
    memory_sampler: {
      executor: 'constant-vus',
      vus: 1,
      duration: DURATION,
      exec: 'sampleMemory',
    },
  },
  thresholds: {
    ws_connect_errors: ['count==0'],
    unexpected_disconnects: ['count==0'],
  },
};

const wsConnectErrors = new Counter('ws_connect_errors');
const unexpectedDisconnects = new Counter('unexpected_disconnects');
const residentMemoryBytes = new Trend('realtime_resident_memory_bytes');

export function sampleMemory() {
  const res = http.get(`${realtimeHttpUrl}/metrics`);
  if (res.status === 200) {
    const match = res.body.match(/^process_resident_memory_bytes\s+(\S+)/m);
    if (match) {
      residentMemoryBytes.add(Number(match[1]));
    }
  }
  sleep(5);
}

export default function () {
  const vuIndex = __VU - 1;
  const room = fixtures.rooms[vuIndex % fixtures.rooms.length];
  const buyer = fixtures.buyers[vuIndex % fixtures.buyers.length];

  let joined = false;
  let intentionalClose = false;

  const res = ws.connect(socketIoUrl(realtimeWsUrl), {}, function (socket) {
    const sio = attachSocketIo(socket, buyer.token, {
      onOpen: function () {
        sio.emit('room.join', { sessionId: room.sessionId });
      },
      onEvent: function (name) {
        if (name === 'room.state') {
          joined = true;
        }
      },
      onClose: function () {
        if (!intentionalClose) {
          unexpectedDisconnects.add(1);
        }
      },
    });

    socket.setInterval(function () {
      sio.emit('heartbeat', { sessionId: room.sessionId });
    }, 20000);

    socket.setTimeout(function () {
      intentionalClose = true;
      socket.close();
    }, 3600000); // safety net only; k6 tears the connection down at scenario end regardless
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 }) || wsConnectErrors.add(1);
  check(null, { 'joined its room': () => joined });
}
