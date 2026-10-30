-- CreateTable
CREATE TABLE "SupportOperationAudit" (
    "id" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportOperationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPrivateNote" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportDelivery" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMPTZ(6),
    "nextAttemptAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackContext" (
    "feedbackId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,

    CONSTRAINT "FeedbackContext_pkey" PRIMARY KEY ("feedbackId")
);

-- CreateTable
CREATE TABLE "FeedbackEscalation" (
    "feedbackId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,

    CONSTRAINT "FeedbackEscalation_pkey" PRIMARY KEY ("feedbackId")
);

-- CreateIndex
CREATE INDEX "SupportOperationAudit_objectType_objectId_createdAt_idx" ON "SupportOperationAudit"("objectType", "objectId", "createdAt");

-- CreateIndex
CREATE INDEX "SupportPrivateNote_ticketId_createdAt_idx" ON "SupportPrivateNote"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupportDelivery_eventKey_key" ON "SupportDelivery"("eventKey");

-- CreateIndex
CREATE INDEX "SupportDelivery_state_nextAttemptAt_idx" ON "SupportDelivery"("state", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FeedbackContext_consultationId_idx" ON "FeedbackContext"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackEscalation_ticketId_key" ON "FeedbackEscalation"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_id_customerId_key" ON "support_tickets"("id", "customerId");

-- AddForeignKey
ALTER TABLE "SupportOperationAudit" ADD CONSTRAINT "SupportOperationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPrivateNote" ADD CONSTRAINT "SupportPrivateNote_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPrivateNote" ADD CONSTRAINT "SupportPrivateNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportDelivery" ADD CONSTRAINT "SupportDelivery_ticketId_ownerId_fkey" FOREIGN KEY ("ticketId", "ownerId") REFERENCES "support_tickets"("id", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportDelivery" ADD CONSTRAINT "SupportDelivery_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackContext" ADD CONSTRAINT "FeedbackContext_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackContext" ADD CONSTRAINT "FeedbackContext_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "CallSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEscalation" ADD CONSTRAINT "FeedbackEscalation_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "feedback"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackEscalation" ADD CONSTRAINT "FeedbackEscalation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- SQL-managed protections, additive only. No historical rows are rewritten.
ALTER TABLE public."SupportDelivery" ADD CONSTRAINT "SupportDelivery_state_check" CHECK ("state" IN ('QUEUED','PROCESSING','SENDING','ACCEPTED','UNKNOWN','CANCELLED','FAILED'));
ALTER TABLE public."SupportDelivery" ADD CONSTRAINT "SupportDelivery_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5);
ALTER TABLE public."SupportOperationAudit" ADD CONSTRAINT "SupportAudit_object_type_check" CHECK ("objectType" IN ('TICKET','FEEDBACK'));
CREATE FUNCTION public.support_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Support audit is append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER support_audit_no_changes BEFORE UPDATE OR DELETE ON public."SupportOperationAudit" FOR EACH ROW EXECUTE FUNCTION public.support_audit_immutable();
CREATE TRIGGER support_audit_no_truncate BEFORE TRUNCATE ON public."SupportOperationAudit" FOR EACH STATEMENT EXECUTE FUNCTION public.support_audit_immutable();
