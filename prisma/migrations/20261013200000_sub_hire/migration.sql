-- CreateTable
CREATE TABLE "SubHireItem" (
    "id" TEXT NOT NULL,
    "ownerContactId" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "categoryId" TEXT,
    "description" TEXT,
    "costPerDay" DECIMAL(12,2),
    "rentalDayPrice" DECIMAL(12,2),
    "links" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubHireItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubHireLine" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subHireItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "costPerDay" DECIMAL(12,2),
    "pricePerDay" DECIMAL(12,2),
    "discountPct" DECIMAL(5,2),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubHireLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubHireItem_ownerContactId_idx" ON "SubHireItem"("ownerContactId");

-- CreateIndex
CREATE INDEX "SubHireItem_manufacturer_name_variant_idx" ON "SubHireItem"("manufacturer", "name", "variant");

-- CreateIndex
CREATE INDEX "SubHireLine_projectId_idx" ON "SubHireLine"("projectId");

-- CreateIndex
CREATE INDEX "SubHireLine_subHireItemId_idx" ON "SubHireLine"("subHireItemId");

-- AddForeignKey
ALTER TABLE "SubHireItem" ADD CONSTRAINT "SubHireItem_ownerContactId_fkey" FOREIGN KEY ("ownerContactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubHireItem" ADD CONSTRAINT "SubHireItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubHireLine" ADD CONSTRAINT "SubHireLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubHireLine" ADD CONSTRAINT "SubHireLine_subHireItemId_fkey" FOREIGN KEY ("subHireItemId") REFERENCES "SubHireItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
