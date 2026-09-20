/*
  Warnings:

  - A unique constraint covering the columns `[senderId,clientMessageId]` on the table `chat_messages` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "clientMessageId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chat_messages_senderId_clientMessageId_key" ON "chat_messages"("senderId", "clientMessageId");
