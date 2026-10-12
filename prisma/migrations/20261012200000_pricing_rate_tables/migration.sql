-- AlterTable
ALTER TABLE "Allocation" ADD COLUMN     "discountPct" DECIMAL(5,2),
ADD COLUMN     "pricePerDay" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "chargeDays" INTEGER,
ADD COLUMN     "discountPct" DECIMAL(5,2),
ADD COLUMN     "rateTableId" TEXT,
ADD COLUMN     "terms" TEXT;

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "chargeDays" INTEGER,
ADD COLUMN     "discountPct" DECIMAL(5,2),
ADD COLUMN     "rateTableId" TEXT,
ADD COLUMN     "terms" TEXT;

-- AlterTable
ALTER TABLE "RentalLine" DROP COLUMN "pricePerWeek",
ADD COLUMN     "discountPct" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "RateTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "extraRule" TEXT NOT NULL DEFAULT 'none',
    "extraFactor" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateTier" (
    "id" TEXT NOT NULL,
    "rateTableId" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "factor" DECIMAL(8,3) NOT NULL,

    CONSTRAINT "RateTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtraLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "rentalId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "discountPct" DECIMAL(5,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RateTable_name_idx" ON "RateTable"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RateTier_rateTableId_days_key" ON "RateTier"("rateTableId", "days");

-- CreateIndex
CREATE INDEX "ExtraLine_projectId_idx" ON "ExtraLine"("projectId");

-- CreateIndex
CREATE INDEX "ExtraLine_rentalId_idx" ON "ExtraLine"("rentalId");

-- AddForeignKey
ALTER TABLE "RateTier" ADD CONSTRAINT "RateTier_rateTableId_fkey" FOREIGN KEY ("rateTableId") REFERENCES "RateTable"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraLine" ADD CONSTRAINT "ExtraLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraLine" ADD CONSTRAINT "ExtraLine_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_rateTableId_fkey" FOREIGN KEY ("rateTableId") REFERENCES "RateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_rateTableId_fkey" FOREIGN KEY ("rateTableId") REFERENCES "RateTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;
