import { AstroParams } from '../../../common/types/astro-params.type';

export function birthParamsToUtc(params: AstroParams): Date {
  const dobMatch = params.dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tobMatch = params.tob.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!dobMatch || !tobMatch) {
    throw new Error('Invalid DOB/TOB format');
  }

  const year = Number(dobMatch[1]);
  const month = Number(dobMatch[2]);
  const day = Number(dobMatch[3]);

  const hour = Number(tobMatch[1]);
  const minute = Number(tobMatch[2]);
  const second = Number(tobMatch[3] ?? '0');

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 ||
    second < 0 || second > 59 ||
    !Number.isFinite(params.timezone) ||
    params.timezone < -12 ||
    params.timezone > 14
  ) {
    throw new Error('Invalid birth date/time/timezone values');
  }

  // Date.UTC normalizes impossible dates and interprets years 00-99 as 1900-1999.
  // Reject normalization rather than calculating a chart for another date.
  const local = new Date(0);
  local.setUTCFullYear(year, month - 1, day);
  local.setUTCHours(hour, minute, second, 0);
  if (year < 1 || local.getUTCFullYear() !== year ||
      local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day) {
    throw new Error('Invalid calendar birth date');
  }
  const localAsUtcMs = local.getTime();

  const utcMs = localAsUtcMs - params.timezone * 60 * 60 * 1000;
  const result = new Date(utcMs);

  if (Number.isNaN(result.getTime())) {
    throw new Error('Unable to calculate UTC birth time');
  }

  return result;
}
