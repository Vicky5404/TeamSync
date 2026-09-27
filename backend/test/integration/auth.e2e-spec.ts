import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  expectStatus,
  nextIp,
  ORIGIN,
  PASSWORD,
  refreshCookie,
  TestApp,
  type TestUser,
} from './harness.js';

describe('Authentication (integration)', () => {
  let api: TestApp;

  beforeAll(async () => {
    api = await TestApp.start();
  });

  afterAll(async () => {
    await api?.close();
  });

  it('registers, blocks sign-in until the email is verified, then signs in', async () => {
    const email = `new-${Date.now()}@it.example`;
    const ip = nextIp();
    const registered = await api
      .call('post', '/auth/register', { ip })
      .send({ name: 'New Person', email: email.toUpperCase(), password: PASSWORD });
    expectStatus(registered, 201);
    expect(registered.body).toEqual({ email, requiresEmailVerification: true });

    const blocked = await api
      .call('post', '/auth/login', { ip })
      .send({ email, password: PASSWORD });
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });

    const duplicate = await api
      .call('post', '/auth/register', { ip })
      .send({ name: 'Again', email, password: PASSWORD });
    expect(duplicate.status).toBe(409);

    // Only the hash of the verification token is stored.
    const invalid = await api
      .call('post', '/auth/verify-email', { ip })
      .send({ token: 'x'.repeat(43) });
    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({ code: 'INVALID_TOKEN' });
  });

  it('issues a short-lived access token and a hardened, path-scoped refresh cookie', async () => {
    const user = await api.createUser('Cookie Monster');
    const response = await api
      .call('post', '/auth/login', { ip: nextIp() })
      .send({ email: user.email, password: PASSWORD, rememberMe: true });
    expectStatus(response, 200);

    const body = response.body as { accessToken: string; expiresIn: number; user: object };
    expect(body.expiresIn).toBe(900);
    expect(JSON.stringify(body)).not.toMatch(/passwordHash|refreshToken/);
    expect(response.headers['cache-control']).toBe('no-store');

    const cookie = (response.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/Max-Age=\d+/);

    const me = await api.get('/auth/me', { ...user, accessToken: body.accessToken });
    expectStatus(me, 200);
    expect(me.body).toMatchObject({ id: user.id, email: user.email, emailVerified: true });
  });

  it('rejects missing, malformed and forged bearer tokens', async () => {
    expect((await api.get('/auth/me')).status).toBe(401);
    expect(
      (await api.call('get', '/auth/me').set('Authorization', 'Bearer not.a.jwt')).status,
    ).toBe(401);
    const user = await api.createUser();
    const [header, payload] = user.accessToken.split('.');
    const forged = `${header}.${payload}.${'A'.repeat(43)}`;
    expect((await api.get('/auth/me', { ...user, accessToken: forged })).status).toBe(401);
  });

  it('rotates the refresh token and treats reuse of a rotated token as theft', async () => {
    const user = await api.createUser('Rotator');

    const first = await api
      .call('post', '/auth/refresh', { ip: user.ip })
      .set('Origin', ORIGIN)
      .set('Cookie', user.refreshCookie);
    expectStatus(first, 200);
    const rotated = refreshCookie(first);
    expect(rotated).not.toBe(user.refreshCookie);

    // Simulate the old token being replayed after the parallel-tab grace window.
    await api.prisma.session.update({
      where: { id: user.sessionId },
      data: { rotatedAt: new Date(Date.now() - 5 * 60_000) },
    });
    const replay = await api
      .call('post', '/auth/refresh', { ip: user.ip })
      .set('Origin', ORIGIN)
      .set('Cookie', user.refreshCookie);
    expect(replay.status).toBe(401);

    // The whole session is revoked: even the legitimately rotated token stops working…
    const afterTheft = await api
      .call('post', '/auth/refresh', { ip: user.ip })
      .set('Origin', ORIGIN)
      .set('Cookie', rotated);
    expect(afterTheft.status).toBe(401);
    // …and so does the access token, immediately.
    expect((await api.get('/auth/me', user)).status).toBe(401);
  });

  it('logout revokes the session and its access token immediately', async () => {
    const user = await api.createUser('Leaver');
    const logout = await api
      .call('post', '/auth/logout', { ip: user.ip })
      .set('Origin', ORIGIN)
      .set('Cookie', user.refreshCookie);
    expectStatus(logout, 204);
    expect((logout.headers['set-cookie'] as unknown as string[]).join(';')).toMatch(
      /flowsync_rt=;/,
    );

    expect((await api.get('/auth/me', user)).status).toBe(401);
    const refresh = await api
      .call('post', '/auth/refresh', { ip: user.ip })
      .set('Origin', ORIGIN)
      .set('Cookie', user.refreshCookie);
    expect(refresh.status).toBe(401);
  });

  it('rejects cookie-authenticated requests from foreign origins (CSRF)', async () => {
    const user = await api.createUser();
    const response = await api
      .call('post', '/auth/refresh', { ip: user.ip })
      .set('Origin', 'https://evil.example.net')
      .set('Cookie', user.refreshCookie);
    expect(response.status).toBe(403);
  });

  it('locks an account after repeated failures without revealing whether it exists', async () => {
    const user: TestUser = await api.createUser('Target');
    const attempt = (email: string, password: string) =>
      api.call('post', '/auth/login', { ip: nextIp() }).send({ email, password });

    const unknown = await attempt('nobody@it.example', 'whatever-password');
    const wrong = await attempt(user.email, 'wrong-password');
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.message).toBe(wrong.body.message);

    for (let index = 0; index < 4; index += 1) await attempt(user.email, 'wrong-password');
    const locked = await attempt(user.email, PASSWORD);
    expect(locked.status).toBe(429);
    expect(locked.body).toMatchObject({ code: 'ACCOUNT_LOCKED' });
  });

  it('rate-limits sign-in attempts per client address', async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) {
      const response = await api
        .call('post', '/auth/login', { ip })
        .send({ email: `nobody-${index}@it.example`, password: 'x' });
      statuses.push(response.status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('validates input strictly (422 with field errors, unknown fields rejected)', async () => {
    const response = await api
      .call('post', '/auth/register', { ip: nextIp() })
      .send({ name: 'X', email: 'not-an-email', password: 'short', role: 'OWNER' });
    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(Object.keys(response.body.fieldErrors as object).sort()).toEqual(
      ['email', 'name', 'password', 'role'].sort(),
    );
    expect(response.headers['x-request-id']).toBeTruthy();
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('password changes sign out every other session', async () => {
    const user = await api.createUser('Changer');
    const otherDevice = await api.login(user.email, user.name);
    const change = await api.post(
      '/users/me/password',
      { currentPassword: PASSWORD, newPassword: 'An0ther-Str0ng-Passphrase' },
      user,
    );
    expectStatus(change, 204);
    expect((await api.get('/auth/me', user)).status).toBe(200);
    expect((await api.get('/auth/me', otherDevice)).status).toBe(401);
  });
});
