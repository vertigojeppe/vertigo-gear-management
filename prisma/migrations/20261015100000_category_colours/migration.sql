-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "color" TEXT,
ADD COLUMN     "lengthColors" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LengthColor" (
    "id" TEXT NOT NULL,
    "metres" DECIMAL(6,2) NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LengthColor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LengthColor_metres_key" ON "LengthColor"("metres");
