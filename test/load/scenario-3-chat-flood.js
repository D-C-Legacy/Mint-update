// 06-REALTIME-AND-CONCURRENCY.md §12, row 3: "100 chat msg/s in one room" ->
// "No backpressure, no dropped broadcasts."
//
// Run against real staging/infra at the documented scale:
//   k6 run -e VUS=150 -e CHAT_RATE_PER_SEC=100 test/load/scenario-3-chat-flood.js
// Defaults below are a local smoke scale (same staging caveat as scenarios 1/2). Run
// `npx ts-node test/load/seed.ts` first.
//
// `05-API-SPEC.md` §13 caps chat at 3 msg/sec PER USER, so hitting an aggregate rate needs many
// distinct chatters, each safely under that per-user cap — NUM_CHATTERS is sized so each one
// sends at roughly CHAT_RATE_PER_SEC/NUM_CHATTERS/sec, comfortably below 3/sec. "No dropped
// broadcasts" is measured by embedding each sent message's own clientRef inside its body (the
// WS broadcast payload itself has no clientRef field — `chat.gateway.ts` only ever emits
// `{message}` — so the body is the one piece of the echo a sender can recognize as its own) and
// confirming every sent message's broadcast comes back within a timeout.
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { socketIoUrl, attachSocketIo } from './lib/socketio.js';
import { realtimeWsUrl, loadFixtures } from './lib/config.js';

const fixtures = loadFixtures();
const room = fixtures.rooms[0];

const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '30s';
const CHAT_RATE_PER_SEC = Number(__ENV.CHAT_RATE_PER_SEC || 5);
// Stay safely under the 3/sec-per-user cap: at most 1 chatter per ceil(rate/2.5) sec-budget.
const NUM_CHATTERS = Math.min(VUS, Math.max(1, Math.ceil(CHAT_RATE_PER_SEC / 2.5)));

export const options = {
  scenarios: {
    viewers: { executor: 'constant-vus', vus: VUS, duration: DURATION, gracefulStop: '5s' },
  },
  thresholds: {
    chat_broadcast_ms: ['p(95)<500'],
    chat_messages_dropped: ['count==0'],
    ws_connect_errors: ['count==0'],
  },
};

const chatBroadcastMs = new Trend('chat_broadcast_ms');
const chatMessagesSent = new Counter('chat_messages_sent');
const chatMessagesDropped = new Counter('chat_messages_dropped');
const wsConnectErrors = new Counter('ws_connect_errors');

export default function () {
  const vuIndex = __VU - 1;
  const buyer = fixtures.buyers[vuIndex % fixtures.buyers.length];
  const isChatter = vuIndex < NUM_CHATTERS;

  const pending = {}; // clientRef -> sentAt

  const res = ws.connect(socketIoUrl(realtimeWsUrl), {}, function (socket) {
    const sio = attachSocketIo(socket, buyer.token, {
      onOpen: function () {
        sio.emit('room.join', { sessionId: room.sessionId });
      },
      onEvent: function (name, data) {
        if (name === 'chat.message' && data.message && typeof data.message.body === 'string') {
          const ref = extractClientRef(data.message.body);
          if (ref && pending[ref] != null) {
            chatBroadcastMs.add(Date.now() - pending[ref]);
            delete pending[ref];
          }
        }
      },
    });

    socket.setInterval(function () {
      sio.emit('heartbeat', { sessionId: room.sessionId });
    }, 20000);

    if (isChatter) {
      const intervalMs = Math.max(350, Math.round((NUM_CHATTERS / CHAT_RATE_PER_SEC) * 1000));
      socket.setInterval(function () {
        const clientRef = `${buyer.userId}-${Date.now()}`;
        pending[clientRef] = Date.now();
        chatMessagesSent.add(1);
        sio.emit('chat.send', {
          sessionId: room.sessionId,
          body: `load test message [ref:${clientRef}]`,
          clientRef: clientRef,
        });
      }, intervalMs);
    }

    socket.setInterval(function () {
      const now = Date.now();
      for (const ref of Object.keys(pending)) {
        if (now - pending[ref] > 5000) {
          chatMessagesDropped.add(1);
          delete pending[ref];
        }
      }
    }, 1000);

    socket.setTimeout(function () {
      socket.close();
    }, 3600000); // safety net only
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 }) || wsConnectErrors.add(1);
}

function extractClientRef(body) {
  const match = body.match(/\[ref:([^\]]+)\]/);
  return match ? match[1] : null;
}
