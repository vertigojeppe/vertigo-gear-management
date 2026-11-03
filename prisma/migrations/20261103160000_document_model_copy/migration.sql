-- AlterTable
ALTER TABLE "PlanDocumentVersion" ADD COLUMN     "modelFileId" TEXT;

-- CreateIndex
CREATE INDEX "PlanDocumentVersion_modelFileId_idx" ON "PlanDocumentVersion"("modelFileId");

-- AddForeignKey
ALTER TABLE "PlanDocumentVersion" ADD CONSTRAINT "PlanDocumentVersion_modelFileId_fkey" FOREIGN KEY ("modelFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
