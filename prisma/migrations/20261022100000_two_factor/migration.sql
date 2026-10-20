-- AlterTable
ALTER TABLE "User" ADD COLUMN     "recoveryCodes" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "totpEnabledAt" TIMESTAMP(3),
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecret" TEXT;
