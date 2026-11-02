import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import IORedis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';
import { redisConfig } from '../../config/redis.config';
import { LoggerService } from '../logger/logger.service';

const logger = new LoggerService();

// 06-REALTIME-AND-CONCURRENCY.md §3: "Use @socket.io/redis-adapter. Do not hand-roll pub/sub
// fanout for socket delivery." Platform-level (not modules/streaming) because the Socket.IO
// server itself is one instance shared by every gateway in the realtime process — chat (P4-06)
// and sales (P5-09) attach their own gateways to the same server, they don't each need their own
// adapter.
export class RedisIoAdapter extends IoAdapter {
  private pubClient: IORedis | undefined;
  private subClient: IORedis | undefined;
  /** Exposed for introspection/shutdown — e.g. verifying the adapter attached correctly, or a
   * future graceful-shutdown hook that needs to close the real `Server` instance directly. */
  ioServer: Server | undefined;

  connectToRedis(): void {
    this.pubClient = new IORedis(redisConfig.url);
    this.subClient = this.pubClient.duplicate();
    // Found live during P9-03 verification: with no `'error'` listener at all, any transient
    // ioredis error on either client (a connection hiccup, a ready-check racing the redis-adapter
    // library's own `.subscribe()` call on `subClient`) is an UNCAUGHT exception — Node crashes
    // the entire process on an EventEmitter 'error' with zero listeners, not just this adapter.
    // ioredis itself retries transient connection errors by default; logging instead of letting
    // the process die lets that retry actually happen.
    this.pubClient.on('error', (err) => logger.error('RedisIoAdapter pubClient error', err.stack ?? String(err)));
    this.subClient.on('error', (err) => logger.error('RedisIoAdapter subClient error', err.stack ?? String(err)));
  }

  override createIOServer(port: number, options?: ServerOptions): Server {
    // NestJS's own IoAdapter#createIOServer is typed `any` (it's a thin wrapper around the
    // socket.io constructor); it is documented and known to return a real `Server` instance.
    const server = super.createIOServer(port, options) as Server;
    if (this.pubClient && this.subClient) {
      server.adapter(createAdapter(this.pubClient, this.subClient));
    }
    this.ioServer = server;
    return server;
  }
}
