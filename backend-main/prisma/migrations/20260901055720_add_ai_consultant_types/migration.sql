-- ============================================================
-- AI CONSULTANT TYPE MASTER
-- Additive production-safe migration.
-- ============================================================

CREATE TABLE IF NOT EXISTS "ai_consultant_types" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "requiresKundli" BOOLEAN NOT NULL DEFAULT false,
    "safetyProfile" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_consultant_types_pkey"
        PRIMARY KEY ("code")
);

CREATE INDEX IF NOT EXISTS
    "ai_consultant_types_isEnabled_idx"
ON "ai_consultant_types"("isEnabled");

CREATE INDEX IF NOT EXISTS
    "ai_consultant_types_sortOrder_idx"
ON "ai_consultant_types"("sortOrder");


-- ------------------------------------------------------------
-- Production consultant catalog.
-- These are configuration records, not dummy data.
-- ------------------------------------------------------------

INSERT INTO "ai_consultant_types"
(
    "code",
    "name",
    "description",
    "iconKey",
    "sortOrder",
    "isEnabled",
    "requiresKundli",
    "safetyProfile",
    "updatedAt"
)
VALUES

(
    'VEDIC_ASTROLOGER',
    'AI Vedic Astrologer',
    'Vedic astrology consultation using verified birth and Kundli context when required.',
    'vedic',
    1,
    true,
    true,
    'ASTROLOGY',
    CURRENT_TIMESTAMP
),

(
    'KP_ASTROLOGER',
    'AI KP Astrologer',
    'KP astrology consultation using supported KP and birth-chart context.',
    'kp',
    2,
    true,
    true,
    'ASTROLOGY',
    CURRENT_TIMESTAMP
),

(
    'NUMEROLOGIST',
    'AI Numerologist',
    'Numerology consultation using applicable numerology inputs and calculations.',
    'numerology',
    3,
    true,
    false,
    'NUMEROLOGY',
    CURRENT_TIMESTAMP
),

(
    'VAASTU_CONSULTANT',
    'AI Vaastu Consultant',
    'Vaastu guidance based on the user-provided property, room, direction, and layout context.',
    'vaastu',
    4,
    true,
    false,
    'VAASTU',
    CURRENT_TIMESTAMP
),

(
    'TAROT_READER',
    'AI Tarot Reader',
    'Tarot-style reflective guidance with transparent non-deterministic interpretation.',
    'tarot',
    5,
    true,
    false,
    'TAROT',
    CURRENT_TIMESTAMP
),

(
    'LIFE_COACH',
    'AI Life Coach',
    'Goal-oriented life coaching for reflection, planning, habits, and personal development.',
    'life_coach',
    6,
    true,
    false,
    'COACHING',
    CURRENT_TIMESTAMP
),

(
    'GENERAL_PSYCHOLOGIST',
    'AI General Psychologist',
    'General emotional wellbeing and psychoeducational support without diagnosis or treatment claims.',
    'psychologist',
    7,
    true,
    false,
    'MENTAL_WELLBEING',
    CURRENT_TIMESTAMP
),

(
    'FENG_SHUI_COACH',
    'AI Feng Shui Coach',
    'Feng Shui guidance based on user-provided space, orientation, goals, and environmental context.',
    'feng_shui',
    8,
    true,
    false,
    'FENG_SHUI',
    CURRENT_TIMESTAMP
),

(
    'AYURVEDIC_CONSULTANT',
    'AI Ayurvedic Consultant',
    'General Ayurvedic wellness education without medical diagnosis or prescription.',
    'ayurveda',
    9,
    true,
    false,
    'AYURVEDA_WELLNESS',
    CURRENT_TIMESTAMP
),

(
    'YOGA_TEACHER',
    'AI Yoga Teacher',
    'General yoga practice, breathing, mobility, relaxation, and wellness guidance.',
    'yoga',
    10,
    true,
    false,
    'YOGA_WELLNESS',
    CURRENT_TIMESTAMP
)

ON CONFLICT ("code")
DO UPDATE SET

    "name" = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "iconKey" = EXCLUDED."iconKey",
    "sortOrder" = EXCLUDED."sortOrder",
    "isEnabled" = EXCLUDED."isEnabled",
    "requiresKundli" = EXCLUDED."requiresKundli",
    "safetyProfile" = EXCLUDED."safetyProfile",
    "updatedAt" = CURRENT_TIMESTAMP;