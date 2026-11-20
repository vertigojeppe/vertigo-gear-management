-- CreateTable
CREATE TABLE "InstallationType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseHours" DECIMAL(6,2),
    "minutesPerUnit" DECIMAL(7,2),
    "unitName" TEXT,
    "ruleCrew" INTEGER,
    "ruleNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallationType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetupRecord" (
    "id" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'build',
    "source" TEXT NOT NULL DEFAULT 'memory',
    "period" TEXT,
    "units" INTEGER,
    "crew" INTEGER,
    "hours" DECIMAL(6,2) NOT NULL,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lesson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetupRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstallationType_name_key" ON "InstallationType"("name");

-- CreateIndex
CREATE INDEX "SetupRecord_typeId_idx" ON "SetupRecord"("typeId");

-- AddForeignKey
ALTER TABLE "SetupRecord" ADD CONSTRAINT "SetupRecord_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "InstallationType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
