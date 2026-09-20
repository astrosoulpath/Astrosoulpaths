-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "encryptedContent" TEXT,
ADD COLUMN     "encryptionMac" TEXT,
ADD COLUMN     "encryptionNonce" TEXT,
ADD COLUMN     "encryptionVersion" INTEGER;

-- CreateTable
CREATE TABLE "chat_encryption_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_encryption_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_encryption_devices_userId_idx" ON "chat_encryption_devices"("userId");

-- CreateIndex
CREATE INDEX "chat_encryption_devices_isActive_idx" ON "chat_encryption_devices"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "chat_encryption_devices_userId_deviceId_key" ON "chat_encryption_devices"("userId", "deviceId");

-- AddForeignKey
ALTER TABLE "chat_encryption_devices" ADD CONSTRAINT "chat_encryption_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
