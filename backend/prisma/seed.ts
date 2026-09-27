/**
 * Development seed: demo accounts, two organizations, projects, tasks, labels,
 * comments, notifications, an invitation and audit entries, so
 * `demo@flowsync.dev / Password123!` works against the real API.
 *
 * - Every account is fake. Teammates use reserved `.example` domains (RFC 2606)
 *   so no email can ever reach a real inbox; the two `flowsync.dev` sign-ins
 *   are the ones documented for the web client.
 * - Idempotent and atomic: skips if the demo user exists, and runs in a single
 *   transaction, so a failed run leaves nothing behind.
 * - Refuses to run against production.
 *
 *   npm run db:seed
 */
import { randomBytes } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';

import { type Prisma, PrismaClient } from '../src/generated/prisma/client.js';
import {
  type LabelColor,
  NotificationType,
  type ProjectStatus,
  type Role,
  type TaskPriority,
  TaskStatus,
} from '../src/generated/prisma/enums.js';

const PASSWORD = 'Password123!';
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== 'true') {
  console.error(
    'Refusing to seed a production database (set SEED_ALLOW_PRODUCTION=true to override).',
  );
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const USERS = [
  {
    key: 'alex',
    name: 'Alex Morgan',
    email: 'demo@flowsync.dev',
    jobTitle: 'Product Lead',
    timezone: 'America/New_York',
  },
  {
    key: 'priya',
    name: 'Priya Sharma',
    email: 'priya.sharma@acme.example',
    jobTitle: 'Engineering Manager',
    timezone: 'Asia/Kolkata',
  },
  {
    key: 'marcus',
    name: 'Marcus Chen',
    email: 'marcus.chen@acme.example',
    jobTitle: 'Senior Frontend Engineer',
    timezone: 'America/Los_Angeles',
  },
  {
    key: 'sofia',
    name: 'Sofia Rodríguez',
    email: 'sofia.rodriguez@acme.example',
    jobTitle: 'Product Designer',
    timezone: 'Europe/Madrid',
  },
  {
    key: 'james',
    name: 'James Okafor',
    email: 'james.okafor@acme.example',
    jobTitle: 'Backend Engineer',
    timezone: 'Europe/London',
  },
  {
    key: 'olivia',
    name: 'Olivia Brown',
    email: 'olivia.brown@acme.example',
    jobTitle: 'Marketing Manager',
    timezone: 'America/Chicago',
  },
  {
    key: 'hana',
    name: 'Hana Sato',
    email: 'hana.sato@northwind.example',
    jobTitle: 'CTO',
    timezone: 'Asia/Tokyo',
  },
] as const;
type UserKey = (typeof USERS)[number]['key'];

const ORGANIZATIONS: Array<{
  key: string;
  name: string;
  slug: string;
  description: string;
  members: Array<[UserKey, Role]>;
}> = [
  {
    key: 'acme',
    name: 'Acme Inc.',
    slug: 'acme',
    description: 'Product & engineering at Acme.',
    members: [
      ['alex', 'OWNER'],
      ['priya', 'ADMIN'],
      ['marcus', 'MANAGER'],
      ['sofia', 'MEMBER'],
      ['james', 'MEMBER'],
      ['olivia', 'VIEWER'],
    ],
  },
  {
    key: 'northwind',
    name: 'Northwind Labs',
    slug: 'northwind',
    description: 'Data platform team.',
    members: [
      ['hana', 'OWNER'],
      ['alex', 'MEMBER'],
      ['james', 'MEMBER'],
    ],
  },
];

const LABELS: Array<[string, LabelColor]> = [
  ['Bug', 'red'],
  ['Feature', 'blue'],
  ['Design', 'violet'],
  ['Docs', 'gray'],
  ['Quick win', 'green'],
];

type TaskSeed = [
  title: string,
  status: TaskStatus,
  priority: TaskPriority,
  assignee: UserKey | null,
  dueInDays: number | null,
  labels: string[],
  /** Soft-deleted this many days ago (shows up in the trash). */
  trashedDaysAgo?: number,
];

const PROJECTS: Array<{
  org: string;
  key: string;
  name: string;
  description: string;
  status: ProjectStatus;
  owner: UserKey;
  members: UserKey[];
  startInDays: number;
  dueInDays: number;
  tasks: TaskSeed[];
}> = [
  {
    org: 'acme',
    key: 'WEB',
    name: 'Website Redesign',
    description: 'Refresh the marketing site with the new brand system.',
    status: 'ACTIVE',
    owner: 'alex',
    members: ['alex', 'marcus', 'sofia', 'priya'],
    startInDays: -30,
    dueInDays: 21,
    tasks: [
      ['Audit current page performance', 'DONE', 'MEDIUM', 'marcus', -10, ['Quick win']],
      ['Design new homepage hero', 'REVIEW', 'HIGH', 'sofia', 2, ['Design']],
      ['Implement responsive navigation', 'IN_PROGRESS', 'HIGH', 'marcus', 4, ['Feature']],
      ['Fix contact form validation on Safari', 'TODO', 'URGENT', 'marcus', -1, ['Bug']],
      ['Write copy for pricing page', 'TODO', 'MEDIUM', 'alex', 7, ['Docs']],
      ['Set up analytics events', 'BACKLOG', 'LOW', null, null, ['Feature']],
      ['Accessibility pass (WCAG AA)', 'TODO', 'HIGH', 'sofia', 10, ['Design']],
      ['Migrate blog to new CMS', 'BACKLOG', 'MEDIUM', 'priya', 25, []],
      ['Old landing page A/B test', 'TODO', 'LOW', null, null, [], 2],
    ],
  },
  {
    org: 'acme',
    key: 'API',
    name: 'Platform API',
    description: 'Public REST API v1 with OAuth and webhooks.',
    status: 'ACTIVE',
    owner: 'priya',
    members: ['priya', 'james', 'alex'],
    startInDays: -60,
    dueInDays: 45,
    tasks: [
      ['Design resource model', 'DONE', 'HIGH', 'james', -30, ['Docs']],
      ['Implement OAuth client credentials', 'DONE', 'HIGH', 'james', -12, ['Feature']],
      ['Webhook delivery with retries', 'IN_PROGRESS', 'URGENT', 'james', 3, ['Feature']],
      ['Rate limiting per API key', 'TODO', 'HIGH', 'priya', 9, ['Feature']],
      ['OpenAPI reference docs', 'TODO', 'MEDIUM', 'alex', 14, ['Docs']],
      ['Pagination returns duplicates under load', 'REVIEW', 'HIGH', 'james', 1, ['Bug']],
    ],
  },
  {
    org: 'acme',
    key: 'MOB',
    name: 'Mobile App',
    description: 'iOS and Android companion app.',
    status: 'PLANNING',
    owner: 'alex',
    members: ['alex', 'sofia'],
    startInDays: 7,
    dueInDays: 120,
    tasks: [
      ['Define MVP scope', 'IN_PROGRESS', 'HIGH', 'alex', 5, ['Docs']],
      ['Onboarding flow wireframes', 'TODO', 'MEDIUM', 'sofia', 12, ['Design']],
      ['Choose cross-platform framework', 'BACKLOG', 'MEDIUM', null, null, []],
    ],
  },
  {
    org: 'northwind',
    key: 'DATA',
    name: 'Data Pipeline',
    description: 'Streaming ingestion and warehouse modelling.',
    status: 'ACTIVE',
    owner: 'hana',
    members: ['hana', 'alex', 'james'],
    startInDays: -20,
    dueInDays: 30,
    tasks: [
      ['Kafka topic conventions', 'DONE', 'MEDIUM', 'hana', -8, ['Docs']],
      ['Backfill historical events', 'IN_PROGRESS', 'HIGH', 'james', 6, ['Feature']],
      ['Dashboard for pipeline lag', 'TODO', 'MEDIUM', 'alex', 9, ['Feature']],
      ['Late events dropped at partition boundary', 'TODO', 'URGENT', 'james', 0, ['Bug']],
    ],
  },
];

/** Comment threads by task identifier: [author, body, hoursAgo, mentions]. */
const COMMENTS: Record<string, Array<[UserKey, string, number, UserKey[]]>> = {
  'WEB-2': [
    ['alex', 'Looks great — can we try a darker variant too?', 30, []],
    ['sofia', '@demo@flowsync.dev added a dark variant in the second frame.', 20, ['alex']],
    ['marcus', 'Both work on mobile; I prefer the dark one for contrast.', 6, []],
  ],
  'WEB-4': [['marcus', 'Reproduced on Safari 17 only — the pattern attribute is ignored.', 12, []]],
  'API-6': [
    ['james', 'Offset pagination skips rows when items are inserted mid-scan.', 28, []],
    ['priya', 'Switching the feed to keyset pagination (created_at, id) should fix it.', 26, []],
  ],
  'DATA-4': [
    ['hana', 'Seeing this on the 00:00 UTC partition roll-over.', 10, []],
    ['james', 'Watermark lags by one partition — patch in review.', 3, ['hana']],
  ],
};

const today = new Date(
  Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
);
const inDays = (days: number) => new Date(today.getTime() + days * DAY_MS);
const hoursAgo = (hours: number) => new Date(Date.now() - hours * HOUR_MS);

async function seed(tx: Prisma.TransactionClient, passwordHash: string): Promise<void> {
  const userIds = new Map<UserKey, string>();
  for (const user of USERS) {
    const created = await tx.user.create({
      data: {
        name: user.name,
        email: user.email,
        jobTitle: user.jobTitle,
        timezone: user.timezone,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    userIds.set(user.key, created.id);
  }
  // Demonstrates the "verify your email" flow on sign-in.
  await tx.user.create({
    data: { name: 'Pending User', email: 'pending@flowsync.dev', passwordHash, timezone: 'UTC' },
  });
  const uid = (key: UserKey) => {
    const id = userIds.get(key);
    if (!id) throw new Error(`Unknown seed user ${key}`);
    return id;
  };

  // --- Organizations, memberships, labels -------------------------------------------
  const orgIds = new Map<string, string>();
  const labelIds = new Map<string, Map<string, string>>();
  for (const org of ORGANIZATIONS) {
    const organization = await tx.organization.create({
      data: {
        name: org.name,
        slug: org.slug,
        description: org.description,
        memberships: {
          create: org.members.map(([user, role]) => ({
            userId: uid(user),
            role,
            lastActiveAt: new Date(),
          })),
        },
        labels: { create: LABELS.map(([name, color]) => ({ name, color })) },
      },
      include: { labels: true },
    });
    orgIds.set(org.key, organization.id);
    labelIds.set(org.key, new Map(organization.labels.map((label) => [label.name, label.id])));
  }
  const oid = (key: string) => {
    const id = orgIds.get(key);
    if (!id) throw new Error(`Unknown seed organization ${key}`);
    return id;
  };

  // --- Projects, tasks, checklists, activity ------------------------------------------
  const tasks = new Map<string, { id: string; organizationId: string; projectId: string }>();
  for (const project of PROJECTS) {
    const organizationId = oid(project.org);
    const created = await tx.project.create({
      data: {
        organizationId,
        key: project.key,
        name: project.name,
        description: project.description,
        status: project.status,
        ownerId: uid(project.owner),
        startDate: inDays(project.startInDays),
        dueDate: inDays(project.dueInDays),
        taskSequence: project.tasks.length,
        // organization_id is filled in from the project (composite key).
        members: { create: project.members.map((member) => ({ userId: uid(member) })) },
      },
    });
    await tx.activity.create({
      data: {
        organizationId,
        projectId: created.id,
        actorId: uid(project.owner),
        action: 'project.created',
        target: { type: 'project', id: created.id, name: created.name },
        createdAt: inDays(project.startInDays),
      },
    });

    const positions = new Map<TaskStatus, number>();
    for (const [
      index,
      [title, status, priority, assignee, dueInDays, labels, trashedDaysAgo],
    ] of project.tasks.entries()) {
      const position = (positions.get(status) ?? 0) + 1024;
      positions.set(status, position);
      const number = index + 1;
      const identifier = `${project.key}-${number}`;
      const createdAt = new Date(Date.now() - (project.tasks.length - index) * 2 * DAY_MS);
      const task = await tx.task.create({
        data: {
          organizationId,
          projectId: created.id,
          number,
          title,
          description: null,
          status,
          priority,
          position,
          assigneeId: assignee ? uid(assignee) : null,
          reporterId: uid(project.owner),
          dueDate: dueInDays === null ? null : inDays(dueInDays),
          createdAt,
          completedAt:
            status === TaskStatus.DONE ? new Date(createdAt.getTime() + 3 * DAY_MS) : null,
          deletedAt: trashedDaysAgo === undefined ? null : inDays(-trashedDaysAgo),
          labels: {
            create: labels
              .map((name) => labelIds.get(project.org)?.get(name))
              .filter((id): id is string => Boolean(id))
              .map((labelId) => ({ labelId })),
          },
        },
      });
      tasks.set(identifier, { id: task.id, organizationId, projectId: created.id });
      await tx.activity.create({
        data: {
          organizationId,
          projectId: created.id,
          taskId: task.id,
          actorId: uid(project.owner),
          action: 'task.created',
          target: { type: 'task', id: task.id, name: title, projectId: created.id, identifier },
          createdAt,
        },
      });
      if (trashedDaysAgo !== undefined) {
        await tx.activity.create({
          data: {
            organizationId,
            projectId: created.id,
            actorId: uid(project.owner),
            action: 'task.deleted',
            target: { type: 'project', id: created.id, name: created.name },
            metadata: { identifier, title },
            createdAt: inDays(-trashedDaysAgo),
          },
        });
      }
      if (index === 1) {
        await tx.checklistItem.createMany({
          data: [
            { taskId: task.id, title: 'Moodboard', completed: true, position: 1024 },
            { taskId: task.id, title: 'Two layout options', completed: true, position: 2048 },
            { taskId: task.id, title: 'Stakeholder review', completed: false, position: 3072 },
          ],
        });
      }
    }
  }
  const task = (identifier: string) => {
    const found = tasks.get(identifier);
    if (!found) throw new Error(`Unknown seed task ${identifier}`);
    return found;
  };

  // --- Comments with mentions ----------------------------------------------------------
  for (const [identifier, thread] of Object.entries(COMMENTS)) {
    const target = task(identifier);
    for (const [author, body, ago, mentions] of thread) {
      await tx.comment.create({
        data: {
          taskId: target.id,
          authorId: uid(author),
          body,
          createdAt: hoursAgo(ago),
          mentions: { create: mentions.map((user) => ({ userId: uid(user) })) },
        },
      });
    }
  }

  // --- Notifications for the demo user ---------------------------------------------------
  const resource = (identifier: string) => {
    const { id, projectId } = task(identifier);
    return { type: 'task', id, projectId };
  };
  await tx.notification.createMany({
    data: [
      {
        userId: uid('alex'),
        organizationId: oid('acme'),
        actorId: uid('priya'),
        type: NotificationType.TASK_ASSIGNED,
        title: 'You were assigned API-5',
        body: 'OpenAPI reference docs',
        resource: resource('API-5'),
        createdAt: hoursAgo(50),
      },
      {
        userId: uid('alex'),
        organizationId: oid('acme'),
        actorId: uid('sofia'),
        type: NotificationType.MENTIONED,
        title: 'Sofia Rodríguez mentioned you on WEB-2',
        body: '@demo@flowsync.dev added a dark variant in the second frame.',
        resource: resource('WEB-2'),
        createdAt: hoursAgo(20),
      },
      {
        userId: uid('alex'),
        organizationId: oid('acme'),
        actorId: uid('marcus'),
        type: NotificationType.TASK_COMMENTED,
        title: 'New comment on WEB-2',
        body: 'Both work on mobile; I prefer the dark one for contrast.',
        resource: resource('WEB-2'),
        createdAt: hoursAgo(6),
      },
      {
        userId: uid('alex'),
        organizationId: oid('acme'),
        actorId: null,
        type: NotificationType.TASK_DUE_SOON,
        title: 'MOB-1 is due soon',
        body: 'Define MVP scope',
        resource: resource('MOB-1'),
        createdAt: hoursAgo(2),
      },
      {
        userId: uid('alex'),
        organizationId: oid('northwind'),
        actorId: uid('hana'),
        type: NotificationType.PROJECT_ADDED,
        title: 'You were added to Data Pipeline',
        body: null,
        resource: { type: 'project', id: task('DATA-1').projectId },
        readAt: hoursAgo(400),
        createdAt: hoursAgo(480),
      },
    ],
  });

  // --- A pending invitation and the audit trail --------------------------------------------
  // The raw token is discarded: the invitation shows up in the UI but its link is unknown.
  const invitation = await tx.invitation.create({
    data: {
      organizationId: oid('acme'),
      email: 'new.hire@acme.example',
      role: 'MEMBER',
      message: 'Welcome aboard!',
      tokenHash: randomBytes(32).toString('hex'),
      invitedById: uid('alex'),
      createdAt: hoursAgo(24),
      expiresAt: inDays(6),
    },
  });
  const marcus = await tx.membership.findUniqueOrThrow({
    where: { organizationId_userId: { organizationId: oid('acme'), userId: uid('marcus') } },
  });
  await tx.auditLog.createMany({
    data: [
      {
        organizationId: oid('acme'),
        actorId: uid('priya'),
        action: 'member.role_changed',
        entityType: 'member',
        entityId: marcus.id,
        metadata: { userId: uid('marcus'), name: 'Marcus Chen', from: 'MEMBER', to: 'MANAGER' },
        createdAt: hoursAgo(72),
      },
      {
        organizationId: oid('acme'),
        actorId: uid('alex'),
        action: 'member.invited',
        entityType: 'invitation',
        entityId: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
        createdAt: hoursAgo(24),
      },
      {
        organizationId: oid('acme'),
        actorId: uid('alex'),
        action: 'task.deleted',
        entityType: 'task',
        entityId: task('WEB-9').id,
        metadata: { identifier: 'WEB-9', title: 'Old landing page A/B test' },
        createdAt: inDays(-2),
      },
    ],
  });
}

async function main(): Promise<void> {
  if (await prisma.user.findUnique({ where: { email: 'demo@flowsync.dev' } })) {
    console.info('Seed data already present — nothing to do.');
    return;
  }

  // Hash once, outside the transaction (Argon2 is deliberately slow).
  const passwordHash = await argon2.hash(PASSWORD, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
  await prisma.$transaction((tx) => seed(tx, passwordHash), { maxWait: 10_000, timeout: 120_000 });

  console.info(
    `Seeded ${USERS.length + 1} users, ${ORGANIZATIONS.length} organizations, ${PROJECTS.length} projects.`,
  );
  console.info(`Sign in with demo@flowsync.dev / ${PASSWORD}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
