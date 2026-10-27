import { isIanaTimeZone, resolveIanaBirthTime } from './iana-birth-time.util';

describe('international birth wall-time resolution', () => {
  it('uses historical IANA offset instead of a current forecast offset', () => {
    expect(resolveIanaBirthTime('2024-01-15','10:00','America/New_York').utc.toISOString()).toBe('2024-01-15T15:00:00.000Z');
    expect(resolveIanaBirthTime('2024-07-15','10:00','America/New_York').utc.toISOString()).toBe('2024-07-15T14:00:00.000Z');
  });
  it('rejects spring gaps and unresolved fall ambiguity', () => {
    expect(() => resolveIanaBirthTime('2024-03-10','02:30','America/New_York')).toThrow('does not exist');
    expect(() => resolveIanaBirthTime('2024-11-03','01:30','America/New_York')).toThrow('Ambiguous');
    expect(resolveIanaBirthTime('2024-11-03','01:30','America/New_York',-5).utc.toISOString()).toBe('2024-11-03T06:30:00.000Z');
  });
  it('supports quarter-hour zones and UTC across midnight', () => {
    expect(resolveIanaBirthTime('2000-01-01','00:15','Asia/Kathmandu').utc.toISOString()).toBe('1999-12-31T18:30:00.000Z');
    expect(isIanaTimeZone('not-a-zone')).toBe(false);
  });
  it('rejects impossible dates without normalization', () => {
    expect(() => resolveIanaBirthTime('2001-02-29','12:00','UTC')).toThrow();
  });
});
