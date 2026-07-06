export type Language = 'en' | 'hi';

export type NumerologyParams = {
  // 🔥 CORE INPUT
  fullName: string;
  dob: string; // YYYY-MM-DD

  // 🌐 LANGUAGE (IMPORTANT)
  lang: Language;

  // 🧠 SYSTEM / INTERNAL (OPTIONAL)
  userId?: string;
  requestId?: string;

  // ⚙️ FEATURE FLAGS (FUTURE USE)
  includeDetails?: boolean;
};
