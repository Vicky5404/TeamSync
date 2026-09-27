import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';

import {
  expectStatus,
  ORIGIN,
  type TaskBody,
  TestApp,
  type TestOrganization,
  type TestProject,
  type TestUser,
} from './harness.js';

/** 1×1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

interface WsMessage {
  type: string;
  payload?: { code?: string; channel?: string };
}

/** Open an authenticated socket and collect every server message. */
async function openSocket(api: TestApp, user: TestUser, origin = ORIGIN) {
  const socket = new WebSocket(`${api.baseUrl.replace('http', 'ws')}/ws`, {
    headers: { Origin: origin },
  });
  const messages: WsMessage[] = [];
  const closed = new Promise<number>((resolve) => socket.on('close', (code) => resolve(code)));
  socket.on('message', (data: Buffer) =>
    messages.push(JSON.parse(data.toString('utf8')) as WsMessage),
  );
  await new Promise<void>((resolve, reject) => {
    socket.once('open', () => resolve());
    socket.once('error', reject);
    socket.once('close', () => resolve());
  });
  const next = async (predicate: (message: WsMessage) => boolean, timeoutMs = 5_000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const found = messages.find(predicate);
      if (found) return found;
      if (Date.now() > deadline)
        throw new Error(`No matching message; got ${JSON.stringify(messages)}`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'auth', token: user.accessToken }));
  }
  return { socket, messages, closed, next };
}

describe('Tenant isolation (integration)', () => {
  let api: TestApp;
  let alice: TestUser;
  let bob: TestUser;
  let orgA: TestOrganization;
  let orgB: TestOrganization;
  let projectA: TestProject;
  let projectB: TestProject;
  let taskA: TaskBody;
  let labelA: string;
  let attachmentA: string;

  beforeAll(async () => {
    api = await TestApp.start();
    alice = await api.createUser('Alice (org A)');
    bob = await api.createUser('Bob (org B)');
    orgA = await api.createOrganization(alice, 'Org A');
    orgB = await api.createOrganization(bob, 'Org B');
    projectA = await api.createProject(alice, orgA);
    projectB = await api.createProject(bob, orgB);
    taskA = await api.createTask(alice, projectA, { title: 'Confidential roadmap' });

    const label = await api.post(
      `/organizations/${orgA.id}/labels`,
      { name: 'Secret', color: 'red' },
      alice,
    );
    expectStatus(label, 201);
    labelA = (label.body as { id: string }).id;

    const upload = await api
      .call('post', `/tasks/${taskA.id}/attachments`, { as: alice })
      .attach('file', PNG, 'diagram.png');
    expectStatus(upload, 201);
    attachmentA = (upload.body as { id: string }).id;
  });

  afterAll(async () => {
    await api?.close();
  });

  it('hides every resource of another organization behind 404 (never 403)', async () => {
    const reads = [
      `/organizations/${orgA.id}`,
      `/organizations/${orgA.id}/projects`,
      `/organizations/${orgA.id}/members`,
      `/organizations/${orgA.id}/tasks`,
      `/organizations/${orgA.id}/labels`,
      `/organizations/${orgA.id}/activity`,
      `/organizations/${orgA.id}/search?q=Confidential`,
      `/projects/${projectA.id}`,
      `/projects/${projectA.id}/tasks`,
      `/tasks/${taskA.id}`,
      `/tasks/${taskA.id}/comments`,
      `/tasks/${taskA.id}/attachments`,
      `/attachments/${attachmentA}/download`,
    ];
    for (const path of reads) {
      const response = await api.get(path, bob);
      expect(response.status, path).toBe(404);
      expect(JSON.stringify(response.body), path).not.toContain('Confidential');
    }
  });

  it("refuses writes to another organization's resources", async () => {
    const writes = [
      api.patch(`/tasks/${taskA.id}`, { title: 'Hijacked' }, bob),
      api.post(`/tasks/${taskA.id}/move`, { status: 'DONE', position: 1 }, bob),
      api.delete(`/tasks/${taskA.id}`, bob),
      api.post(`/tasks/${taskA.id}/comments`, { body: 'hi' }, bob),
      api.post(`/projects/${projectA.id}/tasks`, { title: 'Injected' }, bob),
      api.delete(`/attachments/${attachmentA}`, bob),
      api.patch(`/organizations/${orgA.id}`, { name: 'Pwned' }, bob),
    ];
    for (const response of await Promise.all(writes)) expect(response.status).toBe(404);

    const unchanged = await api.get(`/tasks/${taskA.id}`, alice);
    expect(unchanged.body).toMatchObject({ title: 'Confidential roadmap', status: 'TODO' });
  });

  it('never lets data from one tenant be referenced by another', async () => {
    // Labels and assignees must belong to the task's own organization.
    const withForeignLabel = await api.post(
      `/projects/${projectB.id}/tasks`,
      { title: 'x', labelIds: [labelA] },
      bob,
    );
    expect(withForeignLabel.status).toBe(422);
    const withForeignAssignee = await api.post(
      `/projects/${projectB.id}/tasks`,
      { title: 'x', assigneeId: alice.id },
      bob,
    );
    expect(withForeignAssignee.status).toBe(422);
  });

  it('keeps lists and search scoped to the caller’s organization', async () => {
    const tasks = await api.get(`/organizations/${orgB.id}/tasks?search=Confidential`, bob);
    expectStatus(tasks, 200);
    expect((tasks.body as { data: unknown[] }).data).toEqual([]);
    // Filtering by a foreign project id cannot widen the scope.
    const foreignProject = await api.get(
      `/organizations/${orgB.id}/tasks?projectId=${projectA.id}`,
      bob,
    );
    expect((foreignProject.body as { data: unknown[] }).data).toEqual([]);

    const search = await api.get(`/organizations/${orgB.id}/search?q=Confidential`, bob);
    expectStatus(search, 200);
    expect(search.body).toEqual({ projects: [], tasks: [], members: [] });

    const organizations = await api.get('/organizations', bob);
    expect((organizations.body as Array<{ id: string }>).map((org) => org.id)).toEqual([orgB.id]);
  });

  it('validates uploads by content, not by name', async () => {
    const spoofed = await api
      .call('post', `/tasks/${taskA.id}/attachments`, { as: alice })
      .attach('file', Buffer.from('<html><script>alert(1)</script></html>'), 'innocent.png');
    expect(spoofed.status).toBe(415);

    const svg = await api
      .call('post', `/tasks/${taskA.id}/attachments`, { as: alice })
      .attach('file', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'logo.svg');
    expect(svg.status).toBe(415);

    const tooLarge = await api
      .call('post', `/tasks/${taskA.id}/attachments`, { as: alice })
      .attach('file', Buffer.concat([PNG, Buffer.alloc(1024 * 1024 + 1)]), 'huge.png');
    expect(tooLarge.status).toBe(413);

    const download = await api.get(`/attachments/${attachmentA}/download`, alice);
    expectStatus(download, 200);
    const url = new URL((download.body as { url: string }).url);
    // Short-lived presigned URL that forces a download (never rendered inline).
    expect(url.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(url.searchParams.get('response-content-disposition')).toMatch(/^attachment;/);
  });

  describe('real-time channels', () => {
    it('rejects WebSocket connections from foreign origins', async () => {
      const { closed } = await openSocket(api, alice, 'https://evil.example.net');
      expect(await closed).toBe(1008);
    });

    it("only allows subscribing to the caller's own organization and projects", async () => {
      const { socket, next, messages } = await openSocket(api, bob);
      await next((message) => message.type === 'ready');
      socket.send(JSON.stringify({ type: 'subscribe', channel: `organization:${orgB.id}` }));
      socket.send(JSON.stringify({ type: 'subscribe', channel: `organization:${orgA.id}` }));
      socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectA.id}` }));
      socket.send(JSON.stringify({ type: 'subscribe', channel: `user:${alice.id}` }));
      await next(
        (message) =>
          message.type === 'subscribed' && message.payload?.channel === `organization:${orgB.id}`,
      );
      const forbidden = () =>
        messages.filter(
          (message) => message.type === 'error' && message.payload?.code === 'FORBIDDEN',
        );
      await next(() => forbidden().length === 3);
      const subscribed = messages
        .filter((message) => message.type === 'subscribed')
        .map((message) => message.payload?.channel);
      expect(subscribed).toEqual([`organization:${orgB.id}`]);

      // Events of the other tenant never reach this socket.
      await api.createTask(alice, projectA, { title: 'Not for Bob' });
      await new Promise((resolve) => setTimeout(resolve, 500));
      expect(JSON.stringify(messages)).not.toContain('Not for Bob');
      socket.close();
    });

    it('delivers events to members and closes the socket when the session is revoked', async () => {
      const { socket, next, closed, messages } = await openSocket(api, alice);
      await next((message) => message.type === 'ready');
      socket.send(JSON.stringify({ type: 'subscribe', channel: `project:${projectA.id}` }));
      await next((message) => message.type === 'subscribed');

      const task = await api.createTask(alice, projectA, { title: 'Live update' });
      await next(
        (message) => message.type === 'task.created' && JSON.stringify(message).includes(task.id),
      );

      // Signing out (session revocation) must end the live connection too.
      const logout = await api
        .call('post', '/auth/logout', { ip: alice.ip })
        .set('Origin', ORIGIN)
        .set('Cookie', alice.refreshCookie);
      expectStatus(logout, 204);
      expect(await closed).toBe(4401);
      expect(messages.some((message) => message.type === 'task.created')).toBe(true);
    });
  });
});
