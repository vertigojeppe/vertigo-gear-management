-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "consumable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "minStock" DECIMAL(10,2),
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'pcs';

-- CreateTable
CREATE TABLE "PartFit" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "perUnits" INTEGER NOT NULL DEFAULT 4,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartFit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "kind" TEXT NOT NULL,
    "itemId" TEXT,
    "projectId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartFit_modelId_idx" ON "PartFit"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "PartFit_partId_modelId_key" ON "PartFit"("partId", "modelId");

-- CreateIndex
CREATE INDEX "StockMovement_modelId_createdAt_idx" ON "StockMovement"("modelId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_itemId_idx" ON "StockMovement"("itemId");

-- AddForeignKey
ALTER TABLE "PartFit" ADD CONSTRAINT "PartFit_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartFit" ADD CONSTRAINT "PartFit_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
