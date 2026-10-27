/** Explicit fixed offsets for legacy profiles; IANA names use real DST rules. */
export function notificationLocalDate(timezone: string, at = new Date()): string {
  timezone = timezone.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(timezone)) {
    const offset = Number(timezone);
    if (offset < -12 || offset > 14 || !Number.isInteger(offset * 4)) throw new Error('Invalid timezone');
    return new Date(at.getTime()+offset*3600000).toISOString().slice(0,10);
  }
  return new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
}

export function notificationLocalMinute(timezone: string, at = new Date()): number {
  notificationLocalDate(timezone, at); // Validate both IANA and bounded fixed offsets.
  timezone = timezone.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(timezone)) {
    const local = new Date(at.getTime()+Number(timezone)*3600000);
    return local.getUTCHours()*60+local.getUTCMinutes();
  }
  const parts = new Intl.DateTimeFormat('en-GB',{timeZone:timezone,hourCycle:'h23',hour:'2-digit',minute:'2-digit'}).formatToParts(at);
  return Number(parts.find(p=>p.type==='hour')!.value)*60+Number(parts.find(p=>p.type==='minute')!.value);
}
