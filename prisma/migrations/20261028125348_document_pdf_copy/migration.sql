-- AlterTable
ALTER TABLE "PlanDocumentVersion" ADD COLUMN     "pdfFileId" TEXT;

-- CreateIndex
CREATE INDEX "PlanDocumentVersion_pdfFileId_idx" ON "PlanDocumentVersion"("pdfFileId");

-- AddForeignKey
ALTER TABLE "PlanDocumentVersion" ADD CONSTRAINT "PlanDocumentVersion_pdfFileId_fkey" FOREIGN KEY ("pdfFileId") REFERENCES "File"("id") ON DELETE SET NULL ON UPDATE CASCADE;
