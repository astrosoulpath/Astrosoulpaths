// common/utils/profile-to-astro.mapper.ts

import { AstroParams } from '../types/astro-params.type';

export function profileToAstroParams(profile: any): AstroParams {
  if (!profile) throw new Error('Invalid profile');

  return {
    // ✅ Convert Date → YYYY-MM-DD
    dob: formatDate(profile.birthDate),

    // ✅ Ensure HH:mm:ss format
    tob: formatTime(profile.birthTime),

    lat: profile.lat,
    lon: profile.lon,
    timezone: profile.timezone,

    // ✅ Normalize gender
    gender: profile.gender?.toLowerCase(),

    // optional
    name: profile.name,
    place: profile.city,
  };
}

// 🔥 helpers

function formatDate(date: Date): string {
  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatTime(time: string): string {
  // input: "10:30"
  if (time.length === 5) return `${time}:00`;
  return time; // already HH:mm:ss
}
