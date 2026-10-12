-- CreateTable
CREATE TABLE "PackingList" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "groupBy" TEXT NOT NULL DEFAULT 'category',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "checkedOutAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingLine" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "itemId" TEXT,
    "caseItemId" TEXT,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingCheck" (
    "id" TEXT NOT NULL,
    "lineId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "itemId" TEXT,
    "sourceItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "outcome" TEXT NOT NULL DEFAULT 'ok',
    "note" TEXT,
    "checkedById" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PackingTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackingList_projectId_idx" ON "PackingList"("projectId");

-- CreateIndex
CREATE INDEX "PackingLine_listId_idx" ON "PackingLine"("listId");

-- CreateIndex
CREATE INDEX "PackingCheck_lineId_phase_idx" ON "PackingCheck"("lineId", "phase");

-- CreateIndex
CREATE INDEX "PackingCheck_itemId_idx" ON "PackingCheck"("itemId");

-- CreateIndex
CREATE INDEX "PackingTemplateLine_templateId_idx" ON "PackingTemplateLine"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");

-- CreateIndex
CREATE INDEX "ShareLink_targetType_targetId_idx" ON "ShareLink"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingLine" ADD CONSTRAINT "PackingLine_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PackingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingLine" ADD CONSTRAINT "PackingLine_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingLine" ADD CONSTRAINT "PackingLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingLine" ADD CONSTRAINT "PackingLine_caseItemId_fkey" FOREIGN KEY ("caseItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "PackingLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTemplateLine" ADD CONSTRAINT "PackingTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PackingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingTemplateLine" ADD CONSTRAINT "PackingTemplateLine_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
