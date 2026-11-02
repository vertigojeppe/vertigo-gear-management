-- AlterTable
ALTER TABLE "Todo" ADD COLUMN     "category" TEXT,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
