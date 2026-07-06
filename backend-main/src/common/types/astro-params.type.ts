export type AstroParams = {
  // 🔥 CORE (must have)
  dob: string; // YYYY-MM-DD
  tob: string; // HH:mm:ss
  lat: number;
  lon: number;
  timezone: number;

  // 🌍 OPTIONAL (future-proof)
  name?: string;
  gender?: 'male' | 'female' | 'other';
  place?: string;

  // 🌐 SYSTEM FIELDS (internal use)
  lang?: string; // en, hi, etc.
  ayanamsha?: string; // lahiri, krishnamurti (future astro flexibility)

  // 🧠 METADATA (advanced usage)
  userId?: string; // link to user
  requestId?: string; // tracing/debugging
};
