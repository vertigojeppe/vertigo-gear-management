-- Project contacts become links to library contacts (Contact); the job keeps
-- its own role and notes. Existing rows are matched to a library contact by
-- name when their email and phone do not contradict it; the rest become new
-- person contacts (one per name + email + phone).

ALTER TABLE "ProjectContact" ADD COLUMN "contactId" TEXT;

UPDATE "ProjectContact" pc
SET "contactId" = (
  SELECT c."id"
  FROM "Contact" c
  WHERE lower(trim(c."name")) = lower(trim(pc."name"))
    AND (c."email" IS NULL OR pc."email" IS NULL OR lower(trim(c."email")) = lower(trim(pc."email")))
    AND (c."phone" IS NULL OR pc."phone" IS NULL OR regexp_replace(c."phone", '\D', '', 'g') = regexp_replace(pc."phone", '\D', '', 'g'))
  ORDER BY c."createdAt", c."id"
  LIMIT 1
);

WITH fresh AS (
  SELECT DISTINCT ON (lower(trim("name")), lower(trim(coalesce("email", ''))), coalesce("phone", ''))
    trim("name") AS "name", "email", "phone"
  FROM "ProjectContact"
  WHERE "contactId" IS NULL
  ORDER BY lower(trim("name")), lower(trim(coalesce("email", ''))), coalesce("phone", ''), "id"
),
created AS (
  INSERT INTO "Contact" ("id", "kind", "name", "email", "phone", "createdAt", "updatedAt")
  SELECT 'c' || replace(gen_random_uuid()::text, '-', ''), 'person', "name", "email", "phone", now(), now()
  FROM fresh
  RETURNING "id", "name", "email", "phone"
)
UPDATE "ProjectContact" pc
SET "contactId" = created."id"
FROM created
WHERE pc."contactId" IS NULL
  AND lower(trim(pc."name")) = lower(created."name")
  AND lower(trim(coalesce(pc."email", ''))) = lower(trim(coalesce(created."email", '')))
  AND coalesce(pc."phone", '') = coalesce(created."phone", '');

ALTER TABLE "ProjectContact" ALTER COLUMN "contactId" SET NOT NULL;

ALTER TABLE "ProjectContact" DROP COLUMN "email",
DROP COLUMN "name",
DROP COLUMN "phone";

-- CreateIndex
CREATE INDEX "ProjectContact_contactId_idx" ON "ProjectContact"("contactId");

-- AddForeignKey
ALTER TABLE "ProjectContact" ADD CONSTRAINT "ProjectContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
