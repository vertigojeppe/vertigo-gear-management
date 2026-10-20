-- AlterTable
ALTER TABLE "PackingList" ADD COLUMN     "dismissedSpares" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "packingCheckId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_packingCheckId_key" ON "StockMovement"("packingCheckId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_packingCheckId_fkey" FOREIGN KEY ("packingCheckId") REFERENCES "PackingCheck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
