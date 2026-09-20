-- Voice Note support only.
-- Existing chat/payment/call/AI structures remain untouched.

ALTER TYPE "ChatMessageType" ADD VALUE 'AUDIO';

ALTER TABLE "chat_messages"
ADD COLUMN "audioDurationMs" INTEGER;