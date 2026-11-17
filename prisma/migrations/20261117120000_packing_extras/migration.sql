-- CreateTable
CREATE TABLE "PackingExtra" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "packedAt" TIMESTAMP(3),
    "modelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackingExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackingExtra_listId_idx" ON "PackingExtra"("listId");

-- CreateIndex
CREATE INDEX "PackingExtra_modelId_idx" ON "PackingExtra"("modelId");

-- AddForeignKey
ALTER TABLE "PackingExtra" ADD CONSTRAINT "PackingExtra_listId_fkey" FOREIGN KEY ("listId") REFERENCES "PackingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingExtra" ADD CONSTRAINT "PackingExtra_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "Model"("id") ON DELETE SET NULL ON UPDATE CASCADE;
