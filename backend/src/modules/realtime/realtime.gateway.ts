import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { Logger, type OnModuleDestroy } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Redis } from 'ioredis';
import { WebSocket } from 'ws';

import { AccessResolver, isUuid } from '../../common/authorization/access-resolver.service.js';
import { AppConfig } from '../../config/app-config.js';
import { TokenService } from '../auth/token.service.js';

import { Channels, type RealtimeMessage } from './realtime.events.js';
import { RealtimePublisher } from './realtime.publisher.js';

export const WS_PATH = '/ws';
const MAX_MESSAGE_BYTES = 16 * 1024;
const AUTH_TIMEOUT_MS = 10_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_CHANNELS_PER_CLIENT = 50;
/** Per-connection inbound message budget (sliding 10 s window). */
const MAX_MESSAGES_PER_WINDOW = 60;
const MESSAGE_WINDOW_MS = 10_000;
/** Drop events for clients that stop reading instead of buffering without bound. */
const MAX_BUFFERED_BYTES = 1024 * 1024;
/** Ask for a fresh access token this long before the current one expires… */
const REAUTH_LEAD_MS = 60_000;
/** …and close the connection if none arrives by this long after it expired. */
const REAUTH_GRACE_MS = 30_000;

const CloseCode = { POLICY: 1008, UNAUTHORIZED: 4401, TOO_MANY_MESSAGES: 4429 } as const;

interface ClientState {
  id: string;
  userId: string | null;
  /** Device session of the access token; revoking the session closes the socket. */
  sessionId: string | null;
  /** Expiry of the access token the socket authenticated with (epoch ms). */
  expiresAt: number;
  /** A `reauth` request was sent for the current token. */
  reauthRequested: boolean;
  authenticating: Promise<void> | null;
  authTimer: NodeJS.Timeout | undefined;
  alive: boolean;
  /** channel → organization it belongs to (null for the private user channel) */
  channels: Map<string, string | null>;
  messageTimestamps: number[];
}

type ClientMessage = Record<string, unknown>;

/**
 * Real-time gateway (raw WebSocket, JSON messages — matches the web client's
 * `RealtimeClient`):
 *
 *   client → server: { type: 'auth', token } · { type: 'subscribe' | 'unsubscribe', channel } · { type: 'ping' }
 *   server → client: { type: '<event>', payload } · { type: 'ready' | 'subscribed' | 'pong' | 'reauth' | 'error', … }
 *
 * Channels (`organization:<id>`, `project:<id>`, `user:<id>`) are authorized on
 * subscribe. Events arrive from any API instance or worker over Redis pub/sub
 * and are fanned out to local sockets, each socket receiving an event once.
 *
 * A connection never outlives its credentials: shortly before the access token
 * expires the server sends `reauth` and the client answers with a fresh
 * `auth`; otherwise the socket is closed with 4401. Revoking the device session
 * (logout, password change, account deletion) closes its sockets at once.
 */
@WebSocketGateway({ path: WS_PATH, maxPayload: MAX_MESSAGE_BYTES })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly clients = new Map<WebSocket, ClientState>();
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private subscriber: Redis | undefined;
  private heartbeat: NodeJS.Timeout | undefined;

  constructor(
    private readonly tokens: TokenService,
    private readonly access: AccessResolver,
    private readonly publisher: RealtimePublisher,
    private readonly config: AppConfig,
  ) {}

  afterInit(): void {
    this.publisher.registerLocalDispatcher((message) => this.dispatch(message));

    this.subscriber = new Redis(this.config.redis.url, {
      connectionName: 'flowsync:realtime-subscriber',
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    });
    this.subscriber.on('error', (error: Error) =>
      this.logger.warn(`Realtime subscriber: ${error.message}`),
    );
    this.subscriber.on('message', (_channel: string, raw: string) => {
      try {
        this.dispatch(JSON.parse(raw) as RealtimeMessage);
      } catch (error) {
        this.logger.warn(
          `Dropping malformed realtime message: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
    void this.subscriber
      .subscribe(this.publisher.channel)
      .catch((error: unknown) =>
        this.logger.error({ err: error }, 'Failed to subscribe to realtime channel'),
      );

    // Detect dead connections (clients that vanished without a close frame) and
    // enforce access-token expiry on long-lived connections.
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      for (const [client, state] of this.clients) {
        if (!state.alive) {
          client.terminate();
          continue;
        }
        if (this.enforceExpiry(client, state, now)) continue;
        state.alive = false;
        client.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeat.unref();
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.heartbeat);
    for (const client of this.clients.keys()) client.close(1001, 'Server shutting down');
    await this.subscriber?.quit().catch(() => this.subscriber?.disconnect());
  }

  handleConnection(client: WebSocket, request: IncomingMessage): void {
    // Browsers always send Origin; reject cross-site WebSocket hijacking attempts.
    const origin = request.headers.origin?.replace(/\/+$/, '');
    if (origin && !this.config.http.corsOrigins.includes(origin)) {
      client.close(CloseCode.POLICY, 'Origin not allowed');
      return;
    }
    const state: ClientState = {
      id: randomUUID(),
      userId: null,
      sessionId: null,
      expiresAt: 0,
      reauthRequested: false,
      authenticating: null,
      authTimer: setTimeout(
        () => client.close(CloseCode.UNAUTHORIZED, 'Authentication timeout'),
        AUTH_TIMEOUT_MS,
      ),
      alive: true,
      channels: new Map(),
      messageTimestamps: [],
    };
    client.on('pong', () => {
      state.alive = true;
    });
    this.clients.set(client, state);
  }

  handleDisconnect(client: WebSocket): void {
    const state = this.clients.get(client);
    if (!state) return;
    clearTimeout(state.authTimer);
    for (const channel of state.channels.keys()) this.leave(client, state, channel);
    this.clients.delete(client);
  }

  // -------------------------------------------------------------------------
  // Client → server messages
  // -------------------------------------------------------------------------

  @SubscribeMessage('auth')
  async onAuth(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: ClientMessage,
  ): Promise<void> {
    const state = this.accept(client);
    if (!state) return;
    state.authenticating = this.authenticate(client, state, message.token);
    await state.authenticating;
    state.authenticating = null;
  }

  @SubscribeMessage('subscribe')
  async onSubscribe(
    @ConnectedSocket() client: WebSocket,
    @MessageBody() message: ClientMessage,
  ): Promise<void> {
    const state = this.accept(client);
    if (!state) return;
    // The client sends `subscribe` right after `auth`; wait for authentication to settle.
    if (state.authenticating) await state.authenticating;
    const channel = message.channel;
    if (!state.userId)
      return this.sendError(client, 'UNAUTHORIZED', 'Authenticate before subscribing');
    if (typeof channel !== 'string' || channel.length > 100) {
      return this.sendError(client, 'BAD_REQUEST', 'Invalid channel');
    }
    if (state.channels.has(channel))
      return this.send(client, { type: 'subscribed', payload: { channel } });
    if (state.channels.size >= MAX_CHANNELS_PER_CLIENT) {
      return this.sendError(client, 'BAD_REQUEST', 'Too many subscriptions');
    }

    try {
      const organizationId = await this.authorizeChannel(state.userId, channel);
      if (organizationId === undefined)
        return this.sendError(client, 'FORBIDDEN', `Cannot subscribe to ${channel}`);
      if (client.readyState !== WebSocket.OPEN) return;
      this.join(client, state, channel, organizationId);
      this.send(client, { type: 'subscribed', payload: { channel } });
    } catch (error) {
      this.logger.error({ err: error, channel }, 'Channel authorization failed');
      this.sendError(client, 'INTERNAL_ERROR', 'Could not subscribe right now');
    }
  }

  @SubscribeMessage('unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: WebSocket, @MessageBody() message: ClientMessage): void {
    const state = this.accept(client);
    if (!state || typeof message.channel !== 'string') return;
    if (message.channel === Channels.user(state.userId ?? '')) return; // private channel stays
    this.leave(client, state, message.channel);
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: WebSocket): void {
    if (this.accept(client)) this.send(client, { type: 'pong' });
  }

  // -------------------------------------------------------------------------

  private async authenticate(client: WebSocket, state: ClientState, token: unknown): Promise<void> {
    if (typeof token !== 'string' || token.length > 4096) {
      this.sendError(client, 'UNAUTHORIZED', 'Missing token');
      client.close(CloseCode.UNAUTHORIZED, 'Unauthorized');
      return;
    }
    try {
      const { user, expiresAt } = await this.tokens.verifyAccessToken(token);
      if (state.userId && state.userId !== user.id)
        throw new Error('Cannot switch users on an open connection');
      clearTimeout(state.authTimer);
      state.userId = user.id;
      state.sessionId = user.sessionId;
      state.expiresAt = expiresAt;
      state.reauthRequested = false;
      this.join(client, state, Channels.user(user.id), null);
      this.send(client, { type: 'ready', payload: { userId: user.id } });
    } catch {
      this.sendError(client, 'UNAUTHORIZED', 'Invalid or expired token');
      client.close(CloseCode.UNAUTHORIZED, 'Unauthorized');
    }
  }

  /** Returns the channel's organization id (null for the user channel), or undefined when forbidden. */
  private async authorizeChannel(
    userId: string,
    channel: string,
  ): Promise<string | null | undefined> {
    const [kind, id] = channel.split(':');
    if (!id || !isUuid(id)) return undefined;
    switch (kind) {
      case 'user':
        return id === userId ? null : undefined;
      case 'organization':
        return (await this.access.membership(id, userId)) ? id : undefined;
      case 'project': {
        const scope = await this.access.projectScope(id);
        if (!scope) return undefined;
        return (await this.access.membership(scope.organizationId, userId))
          ? scope.organizationId
          : undefined;
      }
      default:
        return undefined;
    }
  }

  /**
   * Ask an authenticated client for a fresh token shortly before its current
   * one expires, and close it once the grace period has passed without one.
   * Returns true when the socket was closed.
   */
  private enforceExpiry(client: WebSocket, state: ClientState, now: number): boolean {
    if (!state.userId) return false;
    if (now >= state.expiresAt + REAUTH_GRACE_MS) {
      client.close(CloseCode.UNAUTHORIZED, 'Token expired');
      return true;
    }
    if (!state.reauthRequested && now >= state.expiresAt - REAUTH_LEAD_MS) {
      state.reauthRequested = true;
      this.send(client, { type: 'reauth' });
    }
    return false;
  }

  /** Rate-limit inbound messages; returns the client's state if the message may be processed. */
  private accept(client: WebSocket): ClientState | undefined {
    const state = this.clients.get(client);
    if (!state) return undefined;
    const now = Date.now();
    state.messageTimestamps = state.messageTimestamps.filter(
      (time) => now - time < MESSAGE_WINDOW_MS,
    );
    state.messageTimestamps.push(now);
    if (state.messageTimestamps.length > MAX_MESSAGES_PER_WINDOW) {
      client.close(CloseCode.TOO_MANY_MESSAGES, 'Too many messages');
      return undefined;
    }
    return state;
  }

  private join(
    client: WebSocket,
    state: ClientState,
    channel: string,
    organizationId: string | null,
  ): void {
    state.channels.set(channel, organizationId);
    let room = this.rooms.get(channel);
    if (!room) {
      room = new Set();
      this.rooms.set(channel, room);
    }
    room.add(client);
  }

  private leave(client: WebSocket, state: ClientState, channel: string): void {
    state.channels.delete(channel);
    const room = this.rooms.get(channel);
    room?.delete(client);
    if (room?.size === 0) this.rooms.delete(channel);
  }

  /** Deliver a pub/sub message to the local sockets it concerns. */
  private dispatch(message: RealtimeMessage): void {
    if (message.kind === 'revoke') {
      for (const [client, state] of this.clients) {
        if (state.userId !== message.userId) continue;
        for (const [channel, organizationId] of state.channels) {
          if (organizationId === message.organizationId) this.leave(client, state, channel);
        }
      }
      return;
    }
    if (message.kind === 'revoke-sessions') {
      const revoked = new Set(message.sessionIds);
      for (const [client, state] of this.clients) {
        if (state.sessionId && revoked.has(state.sessionId)) {
          for (const channel of [...state.channels.keys()]) this.leave(client, state, channel);
          client.close(CloseCode.UNAUTHORIZED, 'Session revoked');
        }
      }
      return;
    }

    const recipients = new Set<WebSocket>();
    for (const channel of message.channels) {
      this.rooms.get(channel)?.forEach((client) => recipients.add(client));
    }
    if (recipients.size === 0) return;
    const frame = JSON.stringify({ type: message.type, payload: message.payload });
    for (const client of recipients) {
      if (client.readyState !== WebSocket.OPEN) continue;
      if (client.bufferedAmount > MAX_BUFFERED_BYTES) {
        client.terminate();
        continue;
      }
      client.send(frame);
    }
  }

  private send(client: WebSocket, message: object): void {
    if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(message));
  }

  private sendError(client: WebSocket, code: string, message: string): void {
    this.send(client, { type: 'error', payload: { code, message } });
  }
}
