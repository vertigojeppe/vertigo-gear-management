-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "supplierContactId" TEXT,
    "date" DATE,
    "reference" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "listPrice" DECIMAL(12,2),
    "discountPct" DECIMAL(5,2),
    "netPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdById" TEXT,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Purchase_modelId_idx" ON "Purchase"("modelId");

-- CreateIndex
CREATE INDEX "Purchase_supplierContactId_idx" ON "Purchase"("supplierContactId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierContactId_fkey" FOREIGN KEY ("supplierContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
