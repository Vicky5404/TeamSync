import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RealtimeClient, type RealtimeClientOptions } from './client';

/** Minimal in-memory WebSocket double driven by the test. */
class FakeSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeSocket[] = [];

  readyState = FakeSocket.CONNECTING;
  readonly sent: Array<Record<string, unknown>> = [];
  readonly url: string;

  constructor(url: string) {
    super();
    this.url = url;
    FakeSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>);
  }

  close(code = 1000) {
    this.serverClose(code);
  }

  // --- driven by tests -------------------------------------------------------
  serverOpen() {
    this.readyState = FakeSocket.OPEN;
    this.dispatchEvent(new Event('open'));
  }

  serverSend(message: object) {
    this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
  }

  serverClose(code: number) {
    this.readyState = FakeSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code }));
  }
}

const latest = (): FakeSocket => {
  const socket = FakeSocket.instances.at(-1);
  if (!socket) throw new Error('no socket');
  return socket;
};

describe('RealtimeClient', () => {
  let token = 'token-1';

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    token = 'token-1';
    vi.stubGlobal('WebSocket', FakeSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function createClient(overrides: Partial<RealtimeClientOptions> = {}) {
    return new RealtimeClient({
      url: 'ws://localhost/ws',
      getAccessToken: () => token,
      ...overrides,
    });
  }

  it('authenticates, (re)subscribes to channels and delivers events once ready', () => {
    const client = createClient();
    const onTask = vi.fn();
    client.on('task.updated', onTask);
    client.subscribeChannel('organization:o1');
    client.connect();

    const socket = latest();
    socket.serverOpen();
    expect(socket.sent).toEqual([
      { type: 'auth', token: 'token-1' },
      { type: 'subscribe', channel: 'organization:o1' },
    ]);
    expect(client.currentStatus).toBe('connecting');

    socket.serverSend({ type: 'ready', payload: { userId: 'u1' } });
    expect(client.currentStatus).toBe('open');

    socket.serverSend({ type: 'task.updated', payload: { id: 't1' } });
    expect(onTask).toHaveBeenCalledWith({ id: 't1' });
    client.disconnect();
  });

  it('refreshes the session and reconnects after an unauthorized close (4401)', async () => {
    const onAuthFailure = vi.fn(() => {
      token = 'token-2';
      return Promise.resolve(true);
    });
    const client = createClient({ onAuthFailure });
    client.connect();
    latest().serverOpen();
    latest().serverClose(4401);

    await vi.waitFor(() => expect(onAuthFailure).toHaveBeenCalledTimes(1));
    expect(client.currentStatus).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(5_000);

    expect(FakeSocket.instances).toHaveLength(2);
    const second = latest();
    second.serverOpen();
    expect(second.sent[0]).toEqual({ type: 'auth', token: 'token-2' });
    client.disconnect();
  });

  it('re-authenticates in place when the server asks for a fresh token', async () => {
    const onAuthFailure = vi.fn(() => {
      token = 'token-2';
      return Promise.resolve(true);
    });
    const client = createClient({ onAuthFailure });
    client.connect();
    const socket = latest();
    socket.serverOpen();
    socket.serverSend({ type: 'ready' });

    socket.serverSend({ type: 'reauth' });
    await vi.waitFor(() => expect(socket.sent.at(-1)).toEqual({ type: 'auth', token: 'token-2' }));
    expect(FakeSocket.instances).toHaveLength(1);
    expect(client.currentStatus).toBe('open');
    client.disconnect();
  });

  it('asks the app to resync after a reconnect, but not on the first connection', async () => {
    const onReconnect = vi.fn();
    const client = createClient({ onReconnect });
    client.connect();
    latest().serverOpen();
    latest().serverSend({ type: 'ready' });
    expect(onReconnect).not.toHaveBeenCalled();

    latest().serverClose(1006); // dropped, e.g. an API restart
    expect(client.currentStatus).toBe('reconnecting');
    await vi.advanceTimersByTimeAsync(5_000);
    latest().serverOpen();
    latest().serverSend({ type: 'ready' });
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // A re-authentication on the same connection is not a reconnect.
    latest().serverSend({ type: 'ready' });
    expect(onReconnect).toHaveBeenCalledTimes(1);
    client.disconnect();
  });

  it('stops after a rejected refresh instead of looping', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const client = createClient({ onAuthFailure: () => Promise.resolve(false) });
    client.connect();
    latest().serverOpen();
    latest().serverClose(4401);
    await vi.waitFor(() => expect(client.currentStatus).toBe('closed'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });
});
