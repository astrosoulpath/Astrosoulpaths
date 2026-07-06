-- CreateEnum
CREATE TYPE "CallEndReason" AS ENUM (
    'TIMEOUT',
    'REJECTED',
    'CALLER_ENDED',
    'CALLEE_ENDED',
    'DISCONNECT_TIMEOUT'
);