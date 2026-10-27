/** Resolve a local birth wall time using ICU/IANA history, without a provider call.
 * Reject gaps; require an explicit offset for repeated wall times. No guessing. */
export function isIanaTimeZone(zone: string): boolean {
  if (typeof zone !== 'string' || zone.length > 100 || !/^(?:UTC|[A-Za-z_+-]+\/[A-Za-z0-9_+\/-]+)$/.test(zone)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(0); return true; } catch { return false; }
}

export function resolveIanaBirthTime(dob: string, time: string, zone: string, preferredOffsetHours?: number): { utc: Date; offsetHours: number; timeZone: string } {
  if (!isIanaTimeZone(zone) || !/^\d{4}-\d{2}-\d{2}$/.test(dob) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time)) throw new Error('Invalid birth time or IANA timezone');
  const clock = time.length === 5 ? time + ':00' : time;
  const nominal = new Date(`${dob}T${clock}.000Z`);
  if (!Number.isFinite(nominal.getTime()) || nominal.toISOString().slice(0, 10) !== dob || dob.startsWith('0000')) throw new Error('Invalid birth calendar date');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const local = (value: number) => {
    const p = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
    return `${p.year.padStart(4,'0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
  };
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = nominal.getTime() + hours * 3600000;
    offsets.add(new Date(local(sample) + 'Z').getTime() - sample);
  }
  let matches = [...offsets].map(offset => ({ utc: new Date(nominal.getTime() - offset), offsetHours: offset / 3600000, timeZone: zone })).filter(candidate => local(candidate.utc.getTime()) === `${dob}T${clock}`);
  if (matches.length > 1 && preferredOffsetHours !== undefined) matches = matches.filter(candidate => Math.abs(candidate.offsetHours - preferredOffsetHours) < 1e-9);
  if (matches.length !== 1) throw new Error(matches.length ? 'Ambiguous birth time: explicit historical UTC offset required' : 'Birth time does not exist in the selected timezone');
  return matches[0];
}
