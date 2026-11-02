// 06-REALTIME-AND-CONCURRENCY.md §12, row 1: "5,000 viewers in one room, 20 bids/s" ->
// "p95 bid to fanout under 300ms, zero lost bids."
//
// Run against real staging/infra at the documented scale:
//   k6 run -e VUS=5000 -e BID_RATE_PER_SEC=20 test/load/scenario-1-viewers-bid-fanout.js
// Defaults below are a local smoke scale, not a claim this laptop proves 5000 viewers — see
// PROGRESS.md/MEMORY.md (P9-05) for why no staging environment exists yet to run the real number
// against. Run `npx ts-node test/load/seed.ts` first.
//
// Every VU joins the one seeded room as a viewer. A fixed NUM_BIDDERS of them also place bids
// roughly once a second each (independent of VUS, so the aggregate bid rate stays controllable
// — a 5000-viewer room doesn't mean 5000 bids/sec in reality). "Bid to fanout" is measured on
// the bidder's own socket: bid sent -> bid.accepted -> the matching sale.updated broadcast
// arriving back on that same connection. This measures real server processing + one real
// fanout hop, not the full spread across all 5000 sockets (k6 has no built-in cross-VU shared
// state to time that without an extension) — the rest of the room's health is covered
// separately by `ws_connect_errors` (every viewer's own connect) and `bids_lost` (every sent
// bid gets a definitive accepted/rejected response, never silently nothing).
import ws from 'k6/ws';
import { check } from 'k6';
import { Trend, Counter } from 'k6/metrics';
import { socketIoUrl, attachSocketIo } from './lib/socketio.js';
import { realtimeWsUrl, loadFixtures } from './lib/config.js';

const fixtures = loadFixtures();
const room = fixtures.rooms[0];

const VUS = Number(__ENV.VUS || 30);
const DURATION = __ENV.DURATION || '60s';
const BID_RATE_PER_SEC = Number(__ENV.BID_RATE_PER_SEC || 1);
const NUM_BIDDERS = Math.min(VUS, Math.max(1, BID_RATE_PER_SEC));

export const options = {
  scenarios: {
    viewers: { executor: 'constant-vus', vus: VUS, duration: DURATION, gracefulStop: '5s' },
  },
  thresholds: {
    bid_to_fanout_ms: ['p(95)<300'],
    bids_lost: ['count==0'],
    ws_connect_errors: ['count==0'],
  },
};

const bidToFanoutMs = new Trend('bid_to_fanout_ms');
const bidRoundTripMs = new Trend('bid_round_trip_ms');
const bidsSent = new Counter('bids_sent');
const bidsLost = new Counter('bids_lost');
const wsConnectErrors = new Counter('ws_connect_errors');

export default function () {
  const vuIndex = __VU - 1;
  const buyer = fixtures.buyers[vuIndex % fixtures.buyers.length];
  const isBidder = vuIndex < NUM_BIDDERS;

  const pendingByRef = {}; // clientRef -> { sentAt }
  // Keyed by amount at SEND time, not at bid.accepted-arrival time: `sales.gateway.ts`'s own
  // event handler emits `sale.updated` to the room BEFORE `bid.accepted` to the bidder's own
  // channel, so a bidder's own `sale.updated` for its just-accepted bid can arrive first —
  // keying off the accept would miss it. This does mean a rejected bid's amount sits in this
  // map briefly too (harmless: no `sale.updated` will ever carry a rejected amount, and the
  // sweep below clears it out).
  const awaitingFanoutByAmount = {}; // amount (string) -> sentAt
  let lastKnownAmount = 1000; // seed.ts's START_AMOUNT — overwritten by the first real sale.updated

  const res = ws.connect(socketIoUrl(realtimeWsUrl), {}, function (socket) {
    const sio = attachSocketIo(socket, buyer.token, {
      onOpen: function () {
        sio.emit('room.join', { sessionId: room.sessionId });
      },
      onEvent: function (name, data) {
        const now = Date.now();
        if (name === 'sale.updated') {
          const key = String(data.currentAmount);
          if (awaitingFanoutByAmount[key] != null) {
            bidToFanoutMs.add(now - awaitingFanoutByAmount[key]);
            delete awaitingFanoutByAmount[key];
          }
          lastKnownAmount = data.currentAmount;
        } else if (name === 'bid.accepted') {
          const p = pendingByRef[data.clientRef];
          if (p) {
            bidRoundTripMs.add(now - p.sentAt);
            delete pendingByRef[data.clientRef];
          }
        } else if (name === 'bid.rejected') {
          const p = pendingByRef[data.clientRef];
          if (p) {
            bidRoundTripMs.add(now - p.sentAt);
            delete pendingByRef[data.clientRef];
          }
        }
      },
    });

    socket.setInterval(function () {
      sio.emit('heartbeat', { sessionId: room.sessionId });
    }, 20000);

    if (isBidder) {
      socket.setInterval(function () {
        const amount = lastKnownAmount + 100;
        const clientRef = `${buyer.userId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        pendingByRef[clientRef] = { sentAt: Date.now() };
        awaitingFanoutByAmount[String(amount)] = Date.now();
        bidsSent.add(1);
        sio.emit('bid.place', { saleId: room.saleId, amount: amount, clientRef: clientRef });
      }, 1000 + Math.random() * 200);
    }

    // "Zero lost bids" per the scenario's own wording: every sent bid must get a definitive
    // accepted/rejected response, never silently nothing. Also sweeps stale
    // `awaitingFanoutByAmount` entries from rejected bids, which never get a matching
    // `sale.updated` (nothing to delete them otherwise).
    socket.setInterval(function () {
      const now = Date.now();
      for (const ref of Object.keys(pendingByRef)) {
        if (now - pendingByRef[ref].sentAt > 5000) {
          bidsLost.add(1);
          delete pendingByRef[ref];
        }
      }
      for (const amt of Object.keys(awaitingFanoutByAmount)) {
        if (now - awaitingFanoutByAmount[amt] > 5000) {
          delete awaitingFanoutByAmount[amt];
        }
      }
    }, 1000);

    socket.setTimeout(function () {
      socket.close();
    }, 3600000); // safety net only; k6 tears the connection down at scenario end regardless
  });

  check(res, { 'ws connected': (r) => r && r.status === 101 }) || wsConnectErrors.add(1);
}
