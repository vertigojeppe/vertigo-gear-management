-- CreateTable
CREATE TABLE "PlanDocument" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleEntryId" TEXT,
    "taskId" TEXT,
    "previewFileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "fileId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Markup" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "shapes" JSONB NOT NULL DEFAULT '[]',
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Markup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadSession" (
    "id" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "received" INTEGER NOT NULL DEFAULT 0,
    "chunkSize" INTEGER NOT NULL,
    "partKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanDocument_scheduleEntryId_idx" ON "PlanDocument"("scheduleEntryId");

-- CreateIndex
CREATE INDEX "PlanDocument_taskId_idx" ON "PlanDocument"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDocument_planId_name_key" ON "PlanDocument"("planId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "PlanDocumentVersion_documentId_version_key" ON "PlanDocumentVersion"("documentId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Markup_versionId_page_key" ON "Markup"("versionId", "page");

-- CreateIndex
CREATE INDEX "UploadSession_expiresAt_idx" ON "UploadSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_scheduleEntryId_fkey" FOREIGN KEY ("scheduleEntryId") REFERENCES "ScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "PlanTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocument" ADD CONSTRAINT "PlanDocument_previewFileId_fkey" FOREIGN KEY ("previewFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocumentVersion" ADD CONSTRAINT "PlanDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "PlanDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanDocumentVersion" ADD CONSTRAINT "PlanDocumentVersion_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Markup" ADD CONSTRAINT "Markup_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "PlanDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Markup" ADD CONSTRAINT "Markup_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadSession" ADD CONSTRAINT "UploadSession_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
