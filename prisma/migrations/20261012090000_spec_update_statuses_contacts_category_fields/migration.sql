-- DropIndex
DROP INDEX "CustomFieldDefinition_entity_key_key";

-- AlterTable
ALTER TABLE "CustomFieldDefinition" ADD COLUMN     "categoryId" TEXT;

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "notForRental" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retiredReason" TEXT;

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "contactId" TEXT,
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "notForRental" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'person',
    "name" TEXT NOT NULL,
    "organisation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_name_idx" ON "Contact"("name");

-- CreateIndex
CREATE INDEX "CustomFieldDefinition_entity_idx" ON "CustomFieldDefinition"("entity");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDefinition_entity_categoryId_key_key" ON "CustomFieldDefinition"("entity", "categoryId", "key");

-- CreateIndex
CREATE INDEX "Location_userId_idx" ON "Location"("userId");

-- CreateIndex
CREATE INDEX "Location_contactId_idx" ON "Location"("contactId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomFieldDefinition" ADD CONSTRAINT "CustomFieldDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
