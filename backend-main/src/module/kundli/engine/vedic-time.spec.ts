import { birthParamsToUtc } from './vedic-time.util';
import { LocalVedicKundliProvider } from '../providers/local-vedic-kundli.provider';

describe('local Kundli calendar and UTC normalization', () => {
  const params = { dob: '2000-02-29', tob: '00:15:30', lat: 28.6, lon: 77.2, timezone: 5.5 };
  it('normalizes a leap-day with a fractional UTC offset across midnight', () => {
    expect(birthParamsToUtc(params).toISOString()).toBe('2000-02-28T18:45:30.000Z');
  });
  it.each(['2001-02-29', '2026-04-31', '1900-02-29', '0000-01-01'])('rejects impossible calendar date %s', dob => {
    expect(() => birthParamsToUtc({ ...params, dob })).toThrow();
  });
  it('preserves an explicitly supplied historical year rather than adding 1900', () => {
    expect(birthParamsToUtc({ ...params, dob: '0099-01-01', timezone: 0 }).toISOString()).toBe('0099-01-01T00:15:30.000Z');
  });
  it.each([['2024-11-03', '01:30', -4, '2024-11-03T05:30:00.000Z'], ['2024-11-03', '01:30', -5, '2024-11-03T06:30:00.000Z']])('uses the selected UTC offset for a repeated wall-clock time', (dob, tob, offset, expected) => {
    expect(birthParamsToUtc({ ...params, dob: String(dob), tob: String(tob), timezone: Number(offset) }).toISOString()).toBe(expected);
  });
  it.each([{ tob: '24:00' }, { timezone: NaN }, { timezone: 15 }, { dob: 'not-a-date' }])('rejects invalid time/offset inputs %j', change => {
    expect(() => birthParamsToUtc({ ...params, ...change })).toThrow();
  });
  it('repeats natal calculations exactly and keeps language separate from calculated values', async () => {
    const engine = new LocalVedicKundliProvider();
    const birth = { ...params, dob: '1995-08-15', tob: '10:30' };
    const first = await engine.generate(birth, 'en');
    const repeat = await engine.generate(birth, 'en');
    const hindi = await engine.generate(birth, 'hi');
    for (const field of ['planetaryPositions', 'ascendant', 'birthChart', 'navamsaChart'] as const) {
      expect(repeat[field]).toEqual(first[field]);
      expect(hindi[field]).toEqual(first[field]);
    }
    // Internal repeatability only; this does not certify ephemeris accuracy.
  });
});
