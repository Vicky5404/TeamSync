import type { IncomingMessage } from 'node:http';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import type { AccessResolver } from '../../common/authorization/access-resolver.service.js';
import type { AppConfig } from '../../config/app-config.js';
import type { TokenService } from '../auth/token.service.js';

import type { RealtimeMessage } from './realtime.events.js';
import { RealtimeGateway } from './realtime.gateway.js';
import type { RealtimePublisher } from './realtime.publisher.js';

const USER = '0190f0a0-0000-7000-8000-000000000001';
const ORG_OWN = '0190f0a0-0000-7000-8000-0000000000a1';
const ORG_OTHER = '0190f0a0-0000-7000-8000-0000000000b1';
const PROJECT_OWN = '0190f0a0-0000-7000-8000-0000000000a2';
const PROJECT_OTHER = '0190f0a0-0000-7000-8000-0000000000b2';

class FakeSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  readonly sent: Array<{ type: string; payload?: unknown }> = [];
  closedWith: number | undefined;
  send(frame: string) {
    this.sent.push(JSON.parse(frame) as { type: string; payload?: unknown });
  }
  close(code: number) {
    this.closedWith = code;
    this.readyState = WebSocket.CLOSED;
  }
  terminate() {
    this.readyState = WebSocket.CLOSED;
  }
  ping() {}
  on() {}
  types() {
    return this.sent.map((message) => message.type);
  }
}

describe('RealtimeGateway', () => {
  const tokens = { verifyAccessToken: vi.fn() };
  const access = { membership: vi.fn(), projectScope: vi.fn() };
  const config = { http: { corsOrigins: ['https://app.example.com'] } } as AppConfig;
  let gateway: RealtimeGateway;
  let expiresAt: number;

  const request = (origin?: string) =>
    ({ headers: origin ? { origin } : {} }) as unknown as IncomingMessage;

  function connect(origin = 'https://app.example.com') {
    const socket = new FakeSocket();
    gateway.handleConnection(socket as unknown as WebSocket, request(origin));
    return socket;
  }

  async function authenticated(sessionId = 'session-1') {
    tokens.verifyAccessToken.mockResolvedValueOnce({
      user: { id: USER, sessionId },
      expiresAt,
    });
    const socket = connect();
    await gateway.onAuth(socket as unknown as WebSocket, { type: 'auth', token: 'jwt' });
    return socket;
  }

  const subscribe = (socket: FakeSocket, channel: string) =>
    gateway.onSubscribe(socket as unknown as WebSocket, { type: 'subscribe', channel });

  const dispatch = (message: RealtimeMessage) => gateway['dispatch'](message);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    expiresAt = Date.now() + 15 * 60_000;
    access.membership.mockImplementation((organizationId: string) =>
      Promise.resolve(organizationId === ORG_OWN ? { id: 'm1', role: 'MEMBER' } : null),
    );
    access.projectScope.mockImplementation((projectId: string) =>
      Promise.resolve({
        organizationId: projectId === PROJECT_OWN ? ORG_OWN : ORG_OTHER,
        projectId,
      }),
    );
    gateway = new RealtimeGateway(
      tokens as unknown as TokenService,
      access as unknown as AccessResolver,
      {} as RealtimePublisher,
      config,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses connections from origins that are not allowed (cross-site WebSocket hijacking)', () => {
    const socket = connect('https://evil.example.net');
    expect(socket.closedWith).toBe(1008);
  });

  it('closes connections that never authenticate', () => {
    const socket = connect();
    vi.advanceTimersByTime(10_000);
    expect(socket.closedWith).toBe(4401);
  });

  it('rejects invalid tokens with 4401', async () => {
    tokens.verifyAccessToken.mockRejectedValue(new Error('bad token'));
    const socket = connect();
    await gateway.onAuth(socket as unknown as WebSocket, { type: 'auth', token: 'forged' });
    expect(socket.closedWith).toBe(4401);
  });

  it('only lets members subscribe to their own organization and project channels', async () => {
    const socket = await authenticated();
    expect(socket.types()).toEqual(['ready']);

    await subscribe(socket, `organization:${ORG_OWN}`);
    await subscribe(socket, `project:${PROJECT_OWN}`);
    await subscribe(socket, `organization:${ORG_OTHER}`);
    await subscribe(socket, `project:${PROJECT_OTHER}`);
    await subscribe(socket, `user:${ORG_OTHER}`);

    expect(socket.sent.slice(1)).toEqual([
      { type: 'subscribed', payload: { channel: `organization:${ORG_OWN}` } },
      { type: 'subscribed', payload: { channel: `project:${PROJECT_OWN}` } },
      { type: 'error', payload: expect.objectContaining({ code: 'FORBIDDEN' }) },
      { type: 'error', payload: expect.objectContaining({ code: 'FORBIDDEN' }) },
      { type: 'error', payload: expect.objectContaining({ code: 'FORBIDDEN' }) },
    ]);
  });

  it('requires authentication before subscribing', async () => {
    const socket = connect();
    await subscribe(socket, `organization:${ORG_OWN}`);
    expect(socket.sent).toEqual([
      { type: 'error', payload: expect.objectContaining({ code: 'UNAUTHORIZED' }) },
    ]);
    gateway.handleDisconnect(socket as unknown as WebSocket);
  });

  it('delivers an event once per socket even when several subscribed rooms match', async () => {
    const socket = await authenticated();
    await subscribe(socket, `organization:${ORG_OWN}`);
    await subscribe(socket, `project:${PROJECT_OWN}`);
    const outsider = await authenticated('session-2');

    dispatch({
      kind: 'event',
      type: 'task.updated',
      channels: [`project:${PROJECT_OWN}`, `organization:${ORG_OWN}`],
      payload: { id: 't1' },
    });

    expect(socket.sent.filter((message) => message.type === 'task.updated')).toHaveLength(1);
    expect(outsider.types()).not.toContain('task.updated');
  });

  it('stops delivering organization events after the membership is revoked', async () => {
    const socket = await authenticated();
    await subscribe(socket, `organization:${ORG_OWN}`);

    dispatch({ kind: 'revoke', userId: USER, organizationId: ORG_OWN });
    dispatch({
      kind: 'event',
      type: 'task.created',
      channels: [`organization:${ORG_OWN}`],
      payload: {},
    });

    expect(socket.types()).not.toContain('task.created');
    expect(socket.closedWith).toBeUndefined();
  });

  it('closes sockets whose device session was revoked (logout, password change)', async () => {
    const revoked = await authenticated('session-revoked');
    const other = await authenticated('session-kept');

    dispatch({ kind: 'revoke-sessions', sessionIds: ['session-revoked'] });

    expect(revoked.closedWith).toBe(4401);
    expect(other.closedWith).toBeUndefined();
  });

  it('asks for a fresh token before expiry and closes the socket if none arrives', async () => {
    expiresAt = Date.now() + 90_000;
    const socket = await authenticated();
    const state = gateway['clients'].get(socket as unknown as WebSocket);
    if (!state) throw new Error('missing client state');
    const enforce = (now: number) =>
      gateway['enforceExpiry'](socket as unknown as WebSocket, state, now);

    expect(enforce(Date.now())).toBe(false);
    expect(socket.types()).not.toContain('reauth');

    expect(enforce(expiresAt - 30_000)).toBe(false);
    expect(socket.types().filter((type) => type === 'reauth')).toHaveLength(1);
    enforce(expiresAt - 10_000); // asked only once per token
    expect(socket.types().filter((type) => type === 'reauth')).toHaveLength(1);

    expect(enforce(expiresAt + 31_000)).toBe(true);
    expect(socket.closedWith).toBe(4401);
  });

  it('keeps the connection when the client re-authenticates in time', async () => {
    expiresAt = Date.now() + 30_000;
    const socket = await authenticated();
    const state = gateway['clients'].get(socket as unknown as WebSocket);
    if (!state) throw new Error('missing client state');
    gateway['enforceExpiry'](socket as unknown as WebSocket, state, Date.now());
    expect(socket.types()).toContain('reauth');

    const renewedUntil = Date.now() + 15 * 60_000;
    tokens.verifyAccessToken.mockResolvedValueOnce({
      user: { id: USER, sessionId: 'session-1' },
      expiresAt: renewedUntil,
    });
    await gateway.onAuth(socket as unknown as WebSocket, { type: 'auth', token: 'fresh' });

    expect(state.expiresAt).toBe(renewedUntil);
    expect(
      gateway['enforceExpiry'](socket as unknown as WebSocket, state, expiresAt + 60_000),
    ).toBe(false);
    expect(socket.closedWith).toBeUndefined();
  });

  it('refuses to switch users on an open connection', async () => {
    const socket = await authenticated();
    tokens.verifyAccessToken.mockResolvedValueOnce({
      user: { id: 'someone-else', sessionId: 'session-x' },
      expiresAt,
    });
    await gateway.onAuth(socket as unknown as WebSocket, { type: 'auth', token: 'other-user' });
    expect(socket.closedWith).toBe(4401);
  });
});
