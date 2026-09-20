-- CreateTable
CREATE TABLE "ai_astro_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "astrologerId" TEXT NOT NULL,
    "startingCategory" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_astro_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_astro_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_astro_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_astro_conversations_userId_updatedAt_idx" ON "ai_astro_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_astrologerId_updatedAt_idx" ON "ai_astro_conversations"("astrologerId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_astro_conversations_userId_astrologerId_idx" ON "ai_astro_conversations"("userId", "astrologerId");

-- CreateIndex
CREATE INDEX "ai_astro_messages_conversationId_createdAt_idx" ON "ai_astro_messages"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_astro_conversations" ADD CONSTRAINT "ai_astro_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_conversations" ADD CONSTRAINT "ai_astro_conversations_astrologerId_fkey" FOREIGN KEY ("astrologerId") REFERENCES "Astrologer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_astro_messages" ADD CONSTRAINT "ai_astro_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_astro_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
