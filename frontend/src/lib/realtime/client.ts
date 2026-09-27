import type {
  RealtimeClientMessage,
  RealtimeEventType,
  RealtimeHandler,
  RealtimeStatus,
} from './events';

export interface RealtimeClientOptions {
  url: string;
  getAccessToken: () => string | null;
  /**
   * Called when the server rejects the token (close code 4401) or asks for a
   * fresh one before the current token expires (`reauth`). Resolve `true` once
   * a fresh token is available, or `false` to stop.
   */
  onAuthFailure?: () => Promise<boolean>;
  /**
   * Called when a connection is re-established after it was lost. Events sent
   * while disconnected are not replayed, so cached data should be refreshed.
   */
  onReconnect?: () => void;
  heartbeatIntervalMs?: number;
  maxReconnectDelayMs?: number;
}

/** Close code the server uses for a missing, invalid or expired token. */
const UNAUTHORIZED_CLOSE_CODE = 4401;
/** Stop after this many consecutive rejected tokens (avoids refresh loops). */
const MAX_AUTH_FAILURES = 3;

type AnyHandler = (payload: unknown) => void;

/**
 * Minimal, framework-agnostic WebSocket client:
 * - authenticates with the in-memory access token after connecting and is
 *   "open" once the server confirms (`ready`)
 * - refreshes the session when the server rejects an expired token, and
 *   re-authenticates in place when the server asks for a fresh one (`reauth`)
 * - re-subscribes to channels after reconnects and reports them (`onReconnect`)
 *   so missed events can be made up for
 * - reconnects with exponential backoff + jitter (immediately when the browser
 *   comes back online)
 * - keeps the connection alive with a heartbeat
 */
export class RealtimeClient {
  private socket: WebSocket | null = null;
  private status: RealtimeStatus = 'idle';
  private attempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private manuallyClosed = false;
  private authFailures = 0;
  /** A connection was established before, so the next `ready` is a reconnect. */
  private hasBeenReady = false;
  /** The current socket has not been confirmed (`ready`) yet. */
  private awaitingReady = false;
  private readonly channels = new Set<string>();
  private readonly listeners = new Map<RealtimeEventType, Set<AnyHandler>>();
  private readonly statusListeners = new Set<() => void>();
  private readonly options: Required<RealtimeClientOptions>;

  constructor(options: RealtimeClientOptions) {
    this.options = {
      heartbeatIntervalMs: 25_000,
      maxReconnectDelayMs: 30_000,
      onAuthFailure: () => Promise.resolve(false),
      onReconnect: () => undefined,
      ...options,
    };
  }

  private readonly handleOnline = () => {
    if (this.status !== 'reconnecting') return;
    clearTimeout(this.reconnectTimer);
    this.connect();
  };

  get currentStatus(): RealtimeStatus {
    return this.status;
  }

  /** Subscribe to connection status changes (compatible with `useSyncExternalStore`). */
  subscribeStatus(listener: () => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  connect(): void {
    if (this.socket && this.socket.readyState <= WebSocket.OPEN) return;
    this.manuallyClosed = false;
    window.addEventListener('online', this.handleOnline);
    this.setStatus(this.attempts > 0 ? 'reconnecting' : 'connecting');

    const socket = new WebSocket(this.options.url);
    this.socket = socket;
    // Events from a socket that was disconnected or replaced (e.g. React StrictMode
    // re-running effects) are ignored, so a stale socket can never deliver
    // duplicate events or tear down its successor.
    const isCurrent = () => this.socket === socket;

    socket.addEventListener('open', () => {
      if (!isCurrent()) {
        socket.close(1000, 'client disconnect');
        return;
      }
      this.awaitingReady = true;
      const token = this.options.getAccessToken();
      if (token) this.send({ type: 'auth', token });
      this.channels.forEach((channel) => this.send({ type: 'subscribe', channel }));
      this.startHeartbeat();
    });

    socket.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (isCurrent()) this.dispatch(event.data);
    });

    socket.addEventListener('close', (event) => {
      if (!isCurrent()) return;
      this.stopHeartbeat();
      this.socket = null;
      if (this.manuallyClosed) {
        this.setStatus('closed');
      } else if (event.code === UNAUTHORIZED_CLOSE_CODE) {
        void this.recoverFromAuthFailure();
      } else {
        this.scheduleReconnect();
      }
    });

    // Errors are always followed by `close`, where reconnection is handled.
    socket.addEventListener('error', () => undefined);
  }

  disconnect(): void {
    this.manuallyClosed = true;
    window.removeEventListener('online', this.handleOnline);
    clearTimeout(this.reconnectTimer);
    this.stopHeartbeat();
    const socket = this.socket;
    this.socket = null;
    // A socket that is still connecting closes itself once open (closing it now
    // makes the browser log a warning).
    if (socket?.readyState === WebSocket.OPEN) socket.close(1000, 'client disconnect');
    this.setStatus('closed');
  }

  subscribeChannel(channel: string): () => void {
    this.channels.add(channel);
    this.send({ type: 'subscribe', channel });
    return () => {
      this.channels.delete(channel);
      this.send({ type: 'unsubscribe', channel });
    };
  }

  on<T extends RealtimeEventType>(type: T, handler: RealtimeHandler<T>): () => void {
    const handlers = this.listeners.get(type) ?? new Set<AnyHandler>();
    handlers.add(handler as AnyHandler);
    this.listeners.set(type, handlers);
    return () => handlers.delete(handler as AnyHandler);
  }

  private dispatch(raw: unknown): void {
    if (typeof raw !== 'string') return;
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      typeof message !== 'object' ||
      message === null ||
      typeof (message as { type?: unknown }).type !== 'string'
    ) {
      return;
    }
    const { type, payload } = message as {
      type: RealtimeEventType | 'ready' | 'reauth' | 'error';
      payload: unknown;
    };
    if (type === 'error') {
      console.warn('[realtime] server rejected a message:', payload);
      return;
    }
    if (type === 'ready') {
      // Authenticated: events for subscribed channels will now be delivered.
      this.attempts = 0;
      this.authFailures = 0;
      this.setStatus('open');
      if (this.awaitingReady) {
        this.awaitingReady = false;
        if (this.hasBeenReady) this.options.onReconnect();
        this.hasBeenReady = true;
      }
      return;
    }
    if (type === 'reauth') {
      void this.reauthenticate();
      return;
    }
    this.listeners.get(type)?.forEach((handler) => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`[realtime] handler for "${type}" failed`, error);
      }
    });
  }

  private send(message: RealtimeClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /** The server wants a fresh token before the current one expires: refresh and resend. */
  private async reauthenticate(): Promise<void> {
    const refreshed = await this.options.onAuthFailure();
    const token = this.options.getAccessToken();
    // Otherwise the server closes the socket (4401) and the normal recovery runs.
    if (refreshed && token) this.send({ type: 'auth', token });
  }

  private async recoverFromAuthFailure(): Promise<void> {
    this.authFailures += 1;
    const recovered =
      this.authFailures <= MAX_AUTH_FAILURES && (await this.options.onAuthFailure());
    if (this.manuallyClosed) return;
    if (recovered) {
      this.scheduleReconnect();
    } else {
      console.warn('[realtime] WebSocket authentication failed; real-time updates are paused.');
      this.disconnect();
    }
  }

  private scheduleReconnect(): void {
    this.attempts += 1;
    this.setStatus('reconnecting');
    const exponential = Math.min(this.options.maxReconnectDelayMs, 1000 * 2 ** this.attempts);
    const jitter = Math.random() * 0.3 * exponential;
    this.reconnectTimer = setTimeout(() => this.connect(), exponential + jitter);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(
      () => this.send({ type: 'ping' }),
      this.options.heartbeatIntervalMs,
    );
  }

  private stopHeartbeat(): void {
    clearInterval(this.heartbeatTimer);
  }

  private setStatus(status: RealtimeStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener());
  }
}
