import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  eventually,
  expectStatus,
  type TaskBody,
  TestApp,
  type TestOrganization,
  type TestProject,
  type TestUser,
} from './harness.js';

interface NotificationBody {
  type: string;
  title: string;
  actor: { id: string } | null;
  resource: { type: string; id: string } | null;
}

describe('Tasks, roles and notifications (integration)', () => {
  let api: TestApp;
  let owner: TestUser;
  let member: TestUser;
  let viewer: TestUser;
  let organization: TestOrganization;
  let project: TestProject;

  const notificationsOf = async (user: TestUser) => {
    const response = await api.get('/notifications', user);
    expectStatus(response, 200);
    return (response.body as { data: NotificationBody[] }).data;
  };

  beforeAll(async () => {
    api = await TestApp.start();
    owner = await api.createUser('Olivia Owner');
    organization = await api.createOrganization(owner, 'Acme');
    member = await api.addMember(owner, organization, 'MEMBER', 'Max Member');
    viewer = await api.addMember(owner, organization, 'VIEWER', 'Vera Viewer');
    project = await api.createProject(owner, organization, [member.id, viewer.id]);
  });

  afterAll(async () => {
    await api?.close();
  });

  describe('authorization by role', () => {
    it('lets members create tasks but not viewers (403)', async () => {
      await api.createTask(member, project, { title: 'Member task' });
      const denied = await api.post(`/projects/${project.id}/tasks`, { title: 'Nope' }, viewer);
      expect(denied.status).toBe(403);
      expect(denied.body).toMatchObject({ code: 'FORBIDDEN' });
    });

    it('lets viewers read the board', async () => {
      const board = await api.get(`/projects/${project.id}/tasks`, viewer);
      expectStatus(board, 200);
      expect((board.body as TaskBody[]).length).toBeGreaterThan(0);
    });

    it('reserves project management for managers and above', async () => {
      const response = await api.post(
        `/organizations/${organization.id}/projects`,
        { name: 'Member project', key: 'MEMB' },
        member,
      );
      expect(response.status).toBe(403);
    });

    it('prevents members from changing roles and admins from creating owners', async () => {
      const members = await api.get(`/organizations/${organization.id}/members`, owner);
      const viewerMembership = (members.body as Array<{ id: string; user: { id: string } }>).find(
        (row) => row.user.id === viewer.id,
      );
      if (!viewerMembership) throw new Error('viewer membership missing');
      const escalate = await api.patch(
        `/organizations/${organization.id}/members/${viewerMembership.id}`,
        { role: 'ADMIN' },
        member,
      );
      expect(escalate.status).toBe(403);
      const toOwner = await api.patch(
        `/organizations/${organization.id}/members/${viewerMembership.id}`,
        { role: 'OWNER' },
        owner,
      );
      expect(toOwner.status).toBe(403);
    });
  });

  describe('task creation', () => {
    it('numbers tasks per project and appends them to their column', async () => {
      const first = await api.createTask(member, project, { status: 'BACKLOG' });
      const second = await api.createTask(member, project, { status: 'BACKLOG' });
      const [, firstNumber] = first.identifier.split('-');
      expect(second.identifier).toBe(`${project.key}-${Number(firstNumber) + 1}`);
      expect(second.position).toBeGreaterThan(first.position);
      expect(first.status).toBe('BACKLOG');
    });

    it('rejects invalid input with field errors', async () => {
      const response = await api.post(
        `/projects/${project.id}/tasks`,
        { title: '', priority: 'EXTREME', dueDate: '2026-02-30', unknown: true },
        member,
      );
      expect(response.status).toBe(422);
      expect(Object.keys(response.body.fieldErrors as object).sort()).toEqual(
        ['dueDate', 'priority', 'title', 'unknown'].sort(),
      );
    });

    it('stores rich text as plain data (no server-side HTML interpretation)', async () => {
      const title = '<script>alert(1)</script>';
      const task = await api.createTask(member, project, { title });
      const fetched = await api.get(`/tasks/${task.id}`, viewer);
      expect((fetched.body as TaskBody).title).toBe(title);
      expect(fetched.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('task movement', () => {
    it('moves a task across columns and records completion', async () => {
      const task = await api.createTask(member, project, { status: 'REVIEW' });
      const moved = await api.post(
        `/tasks/${task.id}/move`,
        { status: 'DONE', position: 1 },
        member,
      );
      expectStatus(moved, 200);
      expect(moved.body).toMatchObject({ status: 'DONE', position: 1 });
      expect((moved.body as TaskBody).completedAt).not.toBeNull();

      const reopened = await api.post(
        `/tasks/${task.id}/move`,
        { status: 'IN_PROGRESS', position: 1 },
        member,
      );
      expect((reopened.body as TaskBody).completedAt).toBeNull();

      const activity = await api.get(`/tasks/${task.id}/activity`, member);
      expectStatus(activity, 200);
      const actions = (activity.body as Array<{ action: string }>).map((entry) => entry.action);
      expect(actions).toEqual(expect.arrayContaining(['task.completed', 'task.status_changed']));
    });

    it('rebalances a column when a drop position collides', async () => {
      const a = await api.createTask(member, project, { status: 'TODO' });
      const b = await api.createTask(member, project, { status: 'TODO' });
      // Drop `b` exactly onto `a`'s position (float precision exhausted).
      expectStatus(
        await api.post(`/tasks/${b.id}/move`, { status: 'TODO', position: a.position }, member),
        200,
      );
      const board = await api.get(`/projects/${project.id}/tasks?status=TODO`, member);
      const positions = (board.body as TaskBody[]).map((task) => task.position);
      expect(new Set(positions).size).toBe(positions.length);
      // The moved task lands where it was dropped: before `a`.
      const ids = (board.body as TaskBody[]).map((task) => task.id);
      expect(ids.indexOf(b.id)).toBe(ids.indexOf(a.id) - 1);
    });

    it('does not let viewers move tasks', async () => {
      const task = await api.createTask(member, project);
      const response = await api.post(
        `/tasks/${task.id}/move`,
        { status: 'DONE', position: 1 },
        viewer,
      );
      expect(response.status).toBe(403);
    });
  });

  describe('notifications', () => {
    it('notifies the assignee (in-app, via the worker) but never the actor', async () => {
      const task = await api.createTask(owner, project, {
        title: 'Please review the contract',
        assigneeId: member.id,
      });
      const notification = await eventually(async () =>
        (await notificationsOf(member)).find((item) => item.resource?.id === task.id),
      );
      expect(notification).toMatchObject({
        type: 'TASK_ASSIGNED',
        title: `You were assigned ${task.identifier}`,
        actor: expect.objectContaining({ id: owner.id }),
      });

      const selfAssigned = await api.createTask(member, project, { assigneeId: member.id });
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(
        (await notificationsOf(member)).some((item) => item.resource?.id === selfAssigned.id),
      ).toBe(false);
    });

    it('tells the reporter when someone else changes the status', async () => {
      const task = await api.createTask(owner, project, { title: 'Status watched' });
      await api.post(`/tasks/${task.id}/move`, { status: 'IN_PROGRESS', position: 5 }, member);
      const notification = await eventually(async () =>
        (await notificationsOf(owner)).find(
          (item) => item.resource?.id === task.id && item.type === 'TASK_STATUS_CHANGED',
        ),
      );
      expect(notification.title).toContain('in progress');
    });

    it('notifies people mentioned in comments', async () => {
      const task = await api.createTask(owner, project);
      const comment = await api.post(
        `/tasks/${task.id}/comments`,
        { body: `Can you take a look @${viewer.email}?` },
        member,
      );
      expectStatus(comment, 201);
      await eventually(async () =>
        (await notificationsOf(viewer)).find(
          (item) => item.resource?.id === task.id && item.type === 'MENTIONED',
        ),
      );
    });

    it('keeps notifications private to their recipient', async () => {
      const own = await notificationsOf(member);
      expect(own.length).toBeGreaterThan(0);
      const unread = await api.get('/notifications/unread-count', viewer);
      expectStatus(unread, 200);
      const [first] = own;
      if (!first) throw new Error('expected a notification');
      const others = await notificationsOf(viewer);
      expect(others.map((item) => item.title)).not.toContain(first.title);
    });
  });
});
