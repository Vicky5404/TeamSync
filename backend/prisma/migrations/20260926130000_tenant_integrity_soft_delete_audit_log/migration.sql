-- Tenant integrity, soft deletes and the audit log.
--
-- * Composite (id, organization_id) foreign keys: tasks, attachments, activity,
--   task labels and project members can no longer reference another
--   organization's rows; assignees and project members must be organization
--   members.
-- * Soft deletes (deleted_at) for users, projects, tasks and comments, with
--   partial indexes over live rows.
-- * audit_logs: append-only security/administration trail.
-- * CHECK constraints for invariants the application already maintains.
--
-- Safe on populated databases: new NOT NULL columns are backfilled first, and
-- existing rows are normalized to the invariants before they are enforced.
-- Rows that violate tenant boundaries in ways that cannot be repaired
-- mechanically (e.g. a task whose organization differs from its project's)
-- make the migration fail — and, because PostgreSQL runs the script in one
-- transaction, leave the database untouched.

-- ---------------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "projects" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "tasks" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "comments" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);

-- Link tables carry their parent's organization so composite keys can check it.
ALTER TABLE "project_members" ADD COLUMN "organization_id" UUID;
UPDATE "project_members" AS pm
SET "organization_id" = p."organization_id"
FROM "projects" AS p
WHERE p."id" = pm."project_id";
ALTER TABLE "project_members" ALTER COLUMN "organization_id" SET NOT NULL;

ALTER TABLE "task_labels" ADD COLUMN "organization_id" UUID;
UPDATE "task_labels" AS tl
SET "organization_id" = t."organization_id"
FROM "tasks" AS t
WHERE t."id" = tl."task_id";
ALTER TABLE "task_labels" ALTER COLUMN "organization_id" SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Normalize existing rows to the invariants enforced below
-- ---------------------------------------------------------------------------

-- Emails are stored lower-cased.
UPDATE "users" SET "email" = lower("email") WHERE "email" <> lower("email");
UPDATE "invitations" SET "email" = lower("email") WHERE "email" <> lower("email");

-- At most one invitation per organization and email: keep the newest.
DELETE FROM "invitations" AS older
USING "invitations" AS newer
WHERE newer."organization_id" = older."organization_id"
  AND newer."email" = older."email"
  AND (newer."created_at", newer."id") > (older."created_at", older."id");

-- completed_at is set exactly when a task is DONE.
UPDATE "tasks" SET "completed_at" = "updated_at" WHERE "status" = 'DONE' AND "completed_at" IS NULL;
UPDATE "tasks" SET "completed_at" = NULL WHERE "status" <> 'DONE' AND "completed_at" IS NOT NULL;

-- A project's due date is on or after its start date.
UPDATE "projects" SET "due_date" = "start_date" WHERE "due_date" < "start_date";

-- Links that cross an organization boundary are meaningless: drop them, exactly
-- as the application does when a member leaves.
DELETE FROM "task_labels" AS tl
USING "labels" AS l
WHERE l."id" = tl."label_id" AND l."organization_id" <> tl."organization_id";

DELETE FROM "project_members" AS pm
WHERE NOT EXISTS (
  SELECT 1 FROM "memberships" AS m
  WHERE m."organization_id" = pm."organization_id" AND m."user_id" = pm."user_id"
);

UPDATE "tasks" AS t
SET "assignee_id" = NULL
WHERE t."assignee_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" AS m
    WHERE m."organization_id" = t."organization_id" AND m."user_id" = t."assignee_id"
  );

-- ---------------------------------------------------------------------------
-- 3. Composite (tenant-safe) foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE "activities" DROP CONSTRAINT "activities_project_id_fkey";
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_task_id_fkey";
ALTER TABLE "project_members" DROP CONSTRAINT "project_members_project_id_fkey";
ALTER TABLE "task_labels" DROP CONSTRAINT "task_labels_label_id_fkey";
ALTER TABLE "task_labels" DROP CONSTRAINT "task_labels_task_id_fkey";
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_project_id_fkey";

-- Referenced keys.
CREATE UNIQUE INDEX "projects_id_organization_id_key" ON "projects"("id", "organization_id");
CREATE UNIQUE INDEX "tasks_id_organization_id_key" ON "tasks"("id", "organization_id");
CREATE UNIQUE INDEX "labels_id_organization_id_key" ON "labels"("id", "organization_id");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NO ACTION: removing a membership fails while the member still has tasks
-- assigned in that organization (the application unassigns them first).
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_assignee_id_fkey" FOREIGN KEY ("organization_id", "assignee_id") REFERENCES "memberships"("organization_id", "user_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Project memberships disappear with the organization membership.
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_organization_id_user_id_fkey" FOREIGN KEY ("organization_id", "user_id") REFERENCES "memberships"("organization_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_label_id_organization_id_fkey" FOREIGN KEY ("label_id", "organization_id") REFERENCES "labels"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_task_id_organization_id_fkey" FOREIGN KEY ("task_id", "organization_id") REFERENCES "tasks"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_organization_id_fkey" FOREIGN KEY ("project_id", "organization_id") REFERENCES "projects"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------

-- One invitation per organization and email (was a plain index).
DROP INDEX "invitations_organization_id_email_idx";
CREATE UNIQUE INDEX "invitations_organization_id_email_key" ON "invitations"("organization_id", "email");

-- Serves "projects of this user" and the membership foreign key's cascade.
DROP INDEX "project_members_user_id_idx";
CREATE INDEX "project_members_user_id_organization_id_idx" ON "project_members"("user_id", "organization_id");

-- Project keys are unique among live projects only.
DROP INDEX "projects_organization_id_key_key";
CREATE UNIQUE INDEX "projects_organization_id_key_key" ON "projects"("organization_id", "key") WHERE (deleted_at IS NULL);

-- List/filter indexes cover live rows only.
DROP INDEX "projects_organization_id_status_idx";
DROP INDEX "projects_organization_id_updated_at_idx";
CREATE INDEX "projects_organization_id_status_idx" ON "projects"("organization_id", "status") WHERE (deleted_at IS NULL);
CREATE INDEX "projects_organization_id_updated_at_idx" ON "projects"("organization_id", "updated_at") WHERE (deleted_at IS NULL);

DROP INDEX "tasks_project_id_status_position_idx";
DROP INDEX "tasks_organization_id_status_idx";
DROP INDEX "tasks_organization_id_due_date_idx";
DROP INDEX "tasks_organization_id_completed_at_idx";
DROP INDEX "tasks_organization_id_created_at_idx";
CREATE INDEX "tasks_project_id_status_position_idx" ON "tasks"("project_id", "status", "position") WHERE (deleted_at IS NULL);
CREATE INDEX "tasks_organization_id_status_idx" ON "tasks"("organization_id", "status") WHERE (deleted_at IS NULL);
CREATE INDEX "tasks_organization_id_due_date_idx" ON "tasks"("organization_id", "due_date") WHERE (deleted_at IS NULL);
CREATE INDEX "tasks_organization_id_completed_at_idx" ON "tasks"("organization_id", "completed_at") WHERE (deleted_at IS NULL);
CREATE INDEX "tasks_organization_id_created_at_idx" ON "tasks"("organization_id", "created_at") WHERE (deleted_at IS NULL);

-- Organization task list, default sort (updated_at DESC, id DESC).
CREATE INDEX "tasks_organization_id_updated_at_id_idx" ON "tasks"("organization_id", "updated_at" DESC, "id" DESC) WHERE (deleted_at IS NULL);

-- Hourly cross-organization due-date reminder scan.
CREATE INDEX "tasks_due_soon_idx" ON "tasks"("due_date") WHERE ((deleted_at IS NULL) AND (assignee_id IS NOT NULL) AND (status <> 'DONE'::"TaskStatus"));

-- Trash purge (tiny: only soft-deleted rows).
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at") WHERE (deleted_at IS NOT NULL);
CREATE INDEX "tasks_deleted_at_idx" ON "tasks"("deleted_at") WHERE (deleted_at IS NOT NULL);
CREATE INDEX "comments_deleted_at_idx" ON "comments"("deleted_at") WHERE (deleted_at IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 5. CHECK constraints (not modelled by Prisma; never dropped by it)
-- ---------------------------------------------------------------------------

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_format_check" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE "projects" ADD CONSTRAINT "projects_key_format_check" CHECK ("key" ~ '^[A-Z][A-Z0-9]{1,5}$');
ALTER TABLE "projects" ADD CONSTRAINT "projects_task_sequence_check" CHECK ("task_sequence" >= 0);
ALTER TABLE "projects" ADD CONSTRAINT "projects_date_order_check" CHECK ("due_date" >= "start_date");
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_number_check" CHECK ("number" > 0);
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_at_check" CHECK (("status" = 'DONE') = ("completed_at" IS NOT NULL));
-- Rejects NaN and ±Infinity, which would break fractional ordering.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_position_check" CHECK ("position" > '-Infinity'::float8 AND "position" < 'Infinity'::float8);
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_position_check" CHECK ("position" > '-Infinity'::float8 AND "position" < 'Infinity'::float8);
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_size_check" CHECK ("size" >= 0);

-- ---------------------------------------------------------------------------
-- 6. Audit log
-- ---------------------------------------------------------------------------

CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_id" UUID,
    "action" VARCHAR(64) NOT NULL,
    "entity_type" VARCHAR(32) NOT NULL,
    "entity_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "request_id" VARCHAR(128),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_organization_id_created_at_id_idx" ON "audit_logs"("organization_id", "created_at" DESC, "id" DESC);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at" DESC);
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Append-only: rows may be inserted and deleted (retention, tenant deletion)
-- but never changed. The one exception is the actor foreign key being nulled
-- by ON DELETE SET NULL when a user row is hard-deleted.
CREATE FUNCTION "audit_logs_reject_update"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."actor_id" IS NOT NULL AND NEW."actor_id" IS NULL
     AND (to_jsonb(NEW) - 'actor_id') = (to_jsonb(OLD) - 'actor_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE of row % rejected', OLD."id"
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

CREATE TRIGGER "audit_logs_append_only"
BEFORE UPDATE ON "audit_logs"
FOR EACH ROW EXECUTE FUNCTION "audit_logs_reject_update"();
