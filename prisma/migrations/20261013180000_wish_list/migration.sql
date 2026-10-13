-- CreateTable
CREATE TABLE "WishItem" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "variant" TEXT,
    "categoryId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2),
    "rentalDayPrice" DECIMAL(12,2),
    "link" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "modelId" TEXT,
    "createdById" TEXT,
    "importSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishItem_status_idx" ON "WishItem"("status");

-- CreateIndex
CREATE INDEX "WishItem_categoryId_idx" ON "WishItem"("categoryId");

-- AddForeignKey
ALTER TABLE "WishItem" ADD CONSTRAINT "WishItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishItem" ADD CONSTRAINT "WishItem_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishItem" ADD CONSTRAINT "WishItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
