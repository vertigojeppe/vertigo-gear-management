-- AlterTable
ALTER TABLE "PackingCheck" ADD COLUMN     "outCheckId" TEXT,
ADD COLUMN     "resultItemId" TEXT;

-- CreateIndex
CREATE INDEX "PackingCheck_outCheckId_idx" ON "PackingCheck"("outCheckId");

-- AddForeignKey
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_outCheckId_fkey" FOREIGN KEY ("outCheckId") REFERENCES "PackingCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingCheck" ADD CONSTRAINT "PackingCheck_resultItemId_fkey" FOREIGN KEY ("resultItemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
