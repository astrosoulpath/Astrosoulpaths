CREATE TABLE "recharge_packs" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "bonusPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recharge_packs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recharge_packs_isActive_sortOrder_idx"
ON "recharge_packs"("isActive", "sortOrder");