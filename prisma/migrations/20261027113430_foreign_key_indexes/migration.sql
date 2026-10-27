-- CreateIndex
CREATE INDEX "Item_homeLocationId_idx" ON "Item"("homeLocationId");

-- CreateIndex
CREATE INDEX "PackingCheck_resultItemId_idx" ON "PackingCheck"("resultItemId");

-- CreateIndex
CREATE INDEX "PackingLine_modelId_idx" ON "PackingLine"("modelId");

-- CreateIndex
CREATE INDEX "PackingLine_itemId_idx" ON "PackingLine"("itemId");

-- CreateIndex
CREATE INDEX "PackingLine_caseItemId_idx" ON "PackingLine"("caseItemId");

-- CreateIndex
CREATE INDEX "PackingTemplateLine_modelId_idx" ON "PackingTemplateLine"("modelId");

-- CreateIndex
CREATE INDEX "PlanTask_assigneeId_done_idx" ON "PlanTask"("assigneeId", "done");

-- CreateIndex
CREATE INDEX "Project_clientId_idx" ON "Project"("clientId");

-- CreateIndex
CREATE INDEX "ProjectCrew_userId_idx" ON "ProjectCrew"("userId");

-- CreateIndex
CREATE INDEX "Rental_clientId_idx" ON "Rental"("clientId");

-- CreateIndex
CREATE INDEX "RentalLine_modelId_idx" ON "RentalLine"("modelId");

-- CreateIndex
CREATE INDEX "RentalLine_itemId_idx" ON "RentalLine"("itemId");

-- CreateIndex
CREATE INDEX "ScheduleEntry_responsibleId_idx" ON "ScheduleEntry"("responsibleId");

-- CreateIndex
CREATE INDEX "StockMovement_projectId_idx" ON "StockMovement"("projectId");
