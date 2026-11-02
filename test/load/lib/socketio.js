// Minimal hand-rolled Socket.IO v4 (Engine.IO protocol v4) client framing for k6's `k6/ws`
// module. k6 has no official Socket.IO client, and every gateway in this codebase
// (StreamingGateway/SalesGateway/ChatGateway) multiplexes onto the one default namespace — no
// `namespace:` option set on any of them — so this only ever needs: a WS-only Engine.IO
// handshake (no polling fallback), the default-namespace CONNECT packet carrying the JWT the
// same way the real Socket.IO client would (`auth: {token}` -> `handshake.auth.token`, read by
// WsAuthGuard), plain EVENT packets, and server-initiated ping/client-pong keepalive. No ack
// callbacks are needed: every handler in this codebase that replies does so via a separate
// named event (NestJS's `{event, data}` WsResponse convention — e.g. `room.join` triggers a
// later, separate `room.state` event), not a Socket.IO ack on the original emit.

const EIO_OPEN = '0';
const EIO_CLOSE = '1';
const EIO_PING = '2';
const EIO_PONG = '3';
const EIO_MESSAGE = '4';

const SIO_CONNECT = '0';
const SIO_EVENT = '2';

// `wsBaseUrl` like `ws://localhost:3001`. Connecting straight to `transport=websocket` skips
// the polling-then-upgrade dance entirely — Socket.IO's server accepts a WS-only client just
// as happily as its own browser client, which always upgrades the same way in practice.
export function socketIoUrl(wsBaseUrl) {
  return `${wsBaseUrl}/socket.io/?EIO=4&transport=websocket`;
}

// Call once, as the first thing inside `ws.connect(url, params, (socket) => { ... })`. Returns
// `{emit}` for sending events; incoming events reach the caller via `handlers.onEvent(name,
// data)`, and the two handshake milestones via `handlers.onOpen()` (Socket.IO CONNECT ack —
// WsAuthGuard accepted the token) and `handlers.onClose()` (server hung up, incl. a rejected
// auth — `handleConnection`'s catch branch calls `client.disconnect(true)` with no error packet).
export function attachSocketIo(socket, token, handlers) {
  const onEvent = handlers.onEvent || function () {};
  const onOpen = handlers.onOpen || function () {};
  const onClose = handlers.onClose || function () {};

  function emit(event, data) {
    socket.send(EIO_MESSAGE + SIO_EVENT + JSON.stringify([event, data]));
  }

  socket.on('message', function (raw) {
    if (typeof raw !== 'string' || raw.length === 0) {
      return;
    }

    if (raw === EIO_PING) {
      socket.send(EIO_PONG);
      return;
    }

    const eioType = raw.charAt(0);
    const rest = raw.slice(1);

    if (eioType === EIO_OPEN) {
      // Engine.IO handshake payload (`sid`/pingInterval/pingTimeout) — nothing else to read
      // from it; ping/pong above already matches whatever interval the server announces here.
      // Immediately follow with the Socket.IO CONNECT packet carrying the JWT.
      socket.send(EIO_MESSAGE + SIO_CONNECT + JSON.stringify({ token: token }));
      return;
    }

    if (eioType === EIO_CLOSE) {
      onClose();
      return;
    }

    if (eioType !== EIO_MESSAGE) {
      return; // upgrade/noop packets never occur on a WS-only connection
    }

    const sioType = rest.charAt(0);
    const payload = rest.slice(1);

    if (sioType === SIO_CONNECT) {
      onOpen();
      return;
    }

    if (sioType === SIO_EVENT) {
      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch (e) {
        return;
      }
      onEvent(parsed[0], parsed[1]);
      return;
    }
    // CONNECT_ERROR(4)/ACK(3)/binary variants(5,6): not used by this codebase's gateways.
  });

  socket.on('close', onClose);

  return { emit: emit };
}
