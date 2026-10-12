-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "importSource" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "importSource" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "importSource" TEXT;

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "importSource" TEXT,
ADD COLUMN     "rentalDayPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "Rental" ADD COLUMN     "importSource" TEXT;
