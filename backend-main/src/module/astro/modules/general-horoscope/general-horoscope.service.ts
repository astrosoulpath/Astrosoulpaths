import {
  Body,
  Observer,
  SearchMoonPhase,
  SearchRiseSet,
} from 'astronomy-engine';
import { Injectable } from '@nestjs/common';
import {
  calculateVedicTransit,
  LocalVedicTransit,
} from '../../../kundli/engine/vedic-transit.util';
import { calculatePanchang } from '../../../kundli/engine/panchang.util';
import { GeneralHoroscopeInterpretationService } from './general-horoscope-interpretation.service';

const RASHIS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const;

@Injectable()
export class GeneralHoroscopeService {
  /**
   * Real astronomical sunrise for the selected civil date/location.
   * Uses latitude/longitude plus the location's real civil midnight.
   * No country-specific offset and no fixed sunrise clock time.
   */
  private calculateAmantaHinduMonth(calculationUtc: Date): {
    name: string;
    type: 'AMANT';
    previousNewMoonUtc: string;
    nextNewMoonUtc: string;
    solarSignAtPreviousNewMoon: string;
    solarSignNumberAtPreviousNewMoon: number;
  } {
    const monthNames = [
      'Chaitra',
      'Vaishakha',
      'Jyeshtha',
      'Ashadha',
      'Shravana',
      'Bhadrapada',
      'Ashwin',
      'Kartika',
      'Margashirsha',
      'Pausha',
      'Magha',
      'Phalguna',
    ] as const;

    if (Number.isNaN(calculationUtc.getTime())) {
      throw new Error('Invalid Hindu month calculation instant.');
    }

    // Search from sufficiently before the requested Panchang instant.
    // SearchMoonPhase(0, ...) finds a real astronomical New Moon.
    const searchStart = new Date(
      calculationUtc.getTime() - 40 * 24 * 60 * 60 * 1000,
    );

    const previousCandidate = SearchMoonPhase(0, searchStart, 45);

    if (
      !previousCandidate ||
      previousCandidate.date.getTime() > calculationUtc.getTime()
    ) {
      throw new Error('Previous New Moon unavailable for Hindu month.');
    }

    let previousNewMoon = previousCandidate.date;

    // A 45-day window can begin before more than one lunation.
    // Advance through real New Moons until the last one <= calculation time.
    while (true) {
      const nextSearchStart = new Date(previousNewMoon.getTime() + 60 * 1000);

      const nextCandidate = SearchMoonPhase(0, nextSearchStart, 35);

      if (!nextCandidate) {
        throw new Error('Next New Moon unavailable for Hindu month.');
      }

      if (nextCandidate.date.getTime() > calculationUtc.getTime()) {
        const sunTransit = calculateVedicTransit(previousNewMoon);
        const sun = sunTransit.planets.find((planet) => planet.name === 'Sun');

        if (!sun) {
          throw new Error(
            'Sidereal Sun unavailable for Hindu month calculation.',
          );
        }

        // Amanta lunar month is named from the solar sign occupied
        // at the preceding astronomical New Moon:
        // Pisces -> Chaitra, Aries -> Vaishakha, ... Aquarius -> Phalguna.
        const monthIndex = sun.sign_no % 12;

        return {
          name: monthNames[monthIndex],
          type: 'AMANT',
          previousNewMoonUtc: previousNewMoon.toISOString(),
          nextNewMoonUtc: nextCandidate.date.toISOString(),
          solarSignAtPreviousNewMoon: sun.sign,
          solarSignNumberAtPreviousNewMoon: sun.sign_no,
        };
      }

      previousNewMoon = nextCandidate.date;
    }
  }

  private calculatePurnimantaHinduMonth(calculationUtc: Date): {
    name: string;
    type: 'PURNIMANT';
    amantaMonth: string;
    previousFullMoonUtc: string | null;
    nextFullMoonUtc: string;
  } {
    const monthNames = [
      'Chaitra',
      'Vaishakha',
      'Jyeshtha',
      'Ashadha',
      'Shravana',
      'Bhadrapada',
      'Ashwin',
      'Kartika',
      'Margashirsha',
      'Pausha',
      'Magha',
      'Phalguna',
    ] as const;

    if (Number.isNaN(calculationUtc.getTime())) {
      throw new Error('Invalid Purnimanta calculation instant.');
    }

    const amanta = this.calculateAmantaHinduMonth(calculationUtc);

    const amantaIndex = monthNames.indexOf(
      amanta.name as (typeof monthNames)[number],
    );

    if (amantaIndex < 0) {
      throw new Error(
        `Invalid Amanta month for Purnimanta calculation: ${amanta.name}`,
      );
    }

    const searchStart = new Date(
      calculationUtc.getTime() - 35 * 24 * 60 * 60 * 1000,
    );

    let previousFullMoon: Date | null = null;
    let cursor = searchStart;

    while (true) {
      const candidate = SearchMoonPhase(180, cursor, 40);

      if (!candidate) {
        throw new Error('Full Moon unavailable for Purnimanta calculation.');
      }

      if (candidate.date.getTime() > calculationUtc.getTime()) {
        const monthIndex =
          previousFullMoon === null ? amantaIndex : (amantaIndex + 1) % 12;

        return {
          name: monthNames[monthIndex],
          type: 'PURNIMANT',
          amantaMonth: amanta.name,
          previousFullMoonUtc: previousFullMoon?.toISOString() ?? null,
          nextFullMoonUtc: candidate.date.toISOString(),
        };
      }

      previousFullMoon = candidate.date;

      cursor = new Date(candidate.date.getTime() + 60 * 1000);
    }
  }
  private calculateHinduLunarYear(calculationUtc: Date): {
    vikramSamvat: number;
    shakaSamvat: number;
    yearStartNewMoonUtc: string;
    yearStartGregorianYear: number;
    boundarySolarSign: string;
    basis: 'CHAITRA_AMANTA';
  } {
    if (Number.isNaN(calculationUtc.getTime())) {
      throw new Error('Invalid Hindu lunar year calculation instant.');
    }

    const searchStart = new Date(
      Date.UTC(calculationUtc.getUTCFullYear() - 1, 11, 1, 0, 0, 0),
    );

    let cursor = searchStart;
    let yearStartNewMoon: Date | null = null;

    // Scan real astronomical New Moons only.
    // A Chaitra Amanta month starts after the New Moon
    // occurring while the sidereal Sun is in Pisces (#12).
    for (let i = 0; i < 18; i += 1) {
      const candidate = SearchMoonPhase(0, cursor, 40);

      if (!candidate) {
        throw new Error('New Moon unavailable for Hindu lunar year.');
      }

      if (candidate.date.getTime() > calculationUtc.getTime()) {
        break;
      }

      const transit = calculateVedicTransit(candidate.date);

      const sun = transit.planets.find((planet) => planet.name === 'Sun');

      if (!sun) {
        throw new Error('Sidereal Sun unavailable for Hindu lunar year.');
      }

      if (sun.sign_no === 12) {
        yearStartNewMoon = candidate.date;
      }

      cursor = new Date(candidate.date.getTime() + 60 * 1000);
    }

    if (!yearStartNewMoon) {
      throw new Error('Chaitra lunar-year boundary could not be resolved.');
    }

    const boundaryTransit = calculateVedicTransit(yearStartNewMoon);

    const boundarySun = boundaryTransit.planets.find(
      (planet) => planet.name === 'Sun',
    );

    if (!boundarySun || boundarySun.sign_no !== 12) {
      throw new Error('Invalid Chaitra lunar-year boundary.');
    }

    const yearStartGregorianYear = yearStartNewMoon.getUTCFullYear();

    // Vikram Samvat numbering is anchored to the verified
    // Chaitra lunar-year boundary, not to January 1.
    const vikramSamvat = yearStartGregorianYear + 57;
    const shakaSamvat = yearStartGregorianYear - 78;

    return {
      vikramSamvat,
      shakaSamvat,
      yearStartNewMoonUtc: yearStartNewMoon.toISOString(),
      yearStartGregorianYear,
      boundarySolarSign: boundarySun.sign,
      basis: 'CHAITRA_AMANTA',
    };
  }
  private calculateKaliSamvat(vikramSamvat: number): number {
    if (!Number.isInteger(vikramSamvat)) {
      throw new Error('Invalid Vikram Samvat.');
    }

    return vikramSamvat + 3044;
  }

  private calculateSamvatsaraName(vikramSamvat: number): string {
    if (!Number.isInteger(vikramSamvat)) {
      throw new Error('Invalid Vikram Samvat.');
    }

    const names = [
      'Prabhava',
      'Vibhava',
      'Shukla',
      'Pramoduta',
      'Prajotpatti',
      'Angirasa',
      'Shrimukha',
      'Bhava',
      'Yuva',
      'Dhata',
      'Ishvara',
      'Bahudhanya',
      'Pramathi',
      'Vikrama',
      'Vrisha',
      'Chitrabhanu',
      'Svabhanu',
      'Tarana',
      'Parthiva',
      'Vyaya',
      'Sarvajit',
      'Sarvadhari',
      'Virodhi',
      'Vikriti',
      'Khara',
      'Nandana',
      'Vijaya',
      'Jaya',
      'Manmatha',
      'Durmukhi',
      'Hevilambi',
      'Vilambi',
      'Vikari',
      'Sharvari',
      'Plava',
      'Shubhakrit',
      'Shobhakrit',
      'Krodhi',
      'Vishvavasu',
      'Parabhava',
      'Plavanga',
      'Kilaka',
      'Saumya',
      'Sadharana',
      'Virodhikrit',
      'Paridhavi',
      'Pramadi',
      'Ananda',
      'Rakshasa',
      'Nala',
      'Pingala',
      'Kalayukti',
      'Siddharthi',
      'Raudra',
      'Durmati',
      'Dundubhi',
      'Rudhirodgari',
      'Raktakshi',
      'Krodhana',
      'Akshaya',
    ] as const;

    const index = (((vikramSamvat - 2044) % 60) + 60) % 60;

    return names[index];
  }

  private calculateDayDuration(
    sunriseUtc: Date | null,
    sunsetUtc: Date | null,
  ): string | null {
    if (!sunriseUtc || !sunsetUtc) {
      return null;
    }

    const milliseconds = sunsetUtc.getTime() - sunriseUtc.getTime();

    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      return null;
    }

    const totalSeconds = Math.round(milliseconds / 1000);

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }
  /**
   * Traditional weekday-based Disha Shoola.
   *
   * This is intentionally independent of the paid personalized Daily Horoscope.
   * It uses the selected Panchang date's local civil weekday only.
   * No random values and no reference-app output are consumed.
   */
  /**
   * General Panchang Bala lists.
   *
   * These are NOT a personalized user's Bala results.
   *
   * Tara Bala:
   * For each possible Janma Nakshatra, compare it with the current
   * Panchang Nakshatra using the traditional 9-Tara cycle.
   *
   * Favorable Tara positions used here:
   * Sampat (2), Kshema (4), Sadhana (6), Mitra (8), Parama Mitra (9).
   *
   * Chandra Bala:
   * For each possible Janma Rashi, calculate the current Moon's house
   * from that Rashi. The generally favorable houses are:
   * 1, 3, 6, 7, 10 and 11.
   *
   * No birth identity is assumed and no random values are used.
   */
  private calculateGeneralBalaLists(
    currentNakshatra: string | null | undefined,
    currentMoonSign: string | null | undefined,
  ) {
    const nakshatras = [
      'Ashwini',
      'Bharani',
      'Krittika',
      'Rohini',
      'Mrigashira',
      'Ardra',
      'Punarvasu',
      'Pushya',
      'Ashlesha',
      'Magha',
      'Purva Phalguni',
      'Uttara Phalguni',
      'Hasta',
      'Chitra',
      'Swati',
      'Vishakha',
      'Anuradha',
      'Jyeshtha',
      'Mula',
      'Purva Ashadha',
      'Uttara Ashadha',
      'Shravana',
      'Dhanishta',
      'Shatabhisha',
      'Purva Bhadrapada',
      'Uttara Bhadrapada',
      'Revati',
    ] as const;

    const rashis = [
      'Aries',
      'Taurus',
      'Gemini',
      'Cancer',
      'Leo',
      'Virgo',
      'Libra',
      'Scorpio',
      'Sagittarius',
      'Capricorn',
      'Aquarius',
      'Pisces',
    ] as const;

    const normalize = (value: string | null | undefined) =>
      (value ?? '').toLowerCase().replace(/[^a-z]/g, '');

    const currentNakshatraIndex = nakshatras.findIndex(
      (name) => normalize(name) === normalize(currentNakshatra),
    );

    const currentMoonSignIndex = rashis.findIndex(
      (name) => normalize(name) === normalize(currentMoonSign),
    );

    const favorableTaraPositions = new Set([2, 4, 6, 8, 9]);
    const favorableMoonHouses = new Set([1, 3, 6, 7, 10, 11]);

    const taraBala =
      currentNakshatraIndex < 0
        ? []
        : nakshatras.filter((_, janmaIndex) => {
            // Inclusive counting: Janma Nakshatra itself = Tara position 1.
            const distance =
              ((currentNakshatraIndex - janmaIndex + 27) % 27) + 1;

            const taraPosition = ((distance - 1) % 9) + 1;

            return favorableTaraPositions.has(taraPosition);
          });

    const chandraBala =
      currentMoonSignIndex < 0
        ? []
        : rashis.filter((_, janmaRashiIndex) => {
            // Current Moon house counted inclusively from possible Janma Rashi.
            const house =
              ((currentMoonSignIndex - janmaRashiIndex + 12) % 12) + 1;

            return favorableMoonHouses.has(house);
          });

    return {
      taraBala: [...taraBala],
      chandraBala: [...chandraBala],
      currentNakshatra:
        currentNakshatraIndex >= 0 ? nakshatras[currentNakshatraIndex] : null,
      currentMoonSign:
        currentMoonSignIndex >= 0 ? rashis[currentMoonSignIndex] : null,
      methodology: {
        taraBala: 'general-janma-nakshatra-eligibility-9-tara-cycle-v1',
        chandraBala: 'general-janma-rashi-eligibility-moon-house-v1',
      },
    };
  }
  private calculateDishaShoola(localCivilWeekday: string) {
    const directionByWeekday: Record<string, string> = {
      Sunday: 'West',
      Monday: 'East',
      Tuesday: 'North',
      Wednesday: 'North',
      Thursday: 'South',
      Friday: 'West',
      Saturday: 'East',
    };

    const direction = directionByWeekday[localCivilWeekday] ?? null;

    return {
      direction,
      weekday: localCivilWeekday,
      methodology: 'traditional-weekday-disha-shoola-v1',
    };
  }
  private calculateAuspiciousInauspiciousTimings(
    sunriseUtc: Date | null,
    sunsetUtc: Date | null,
    localCivilWeekday: string,
    timezoneName?: string,
    timezone?: number,
  ) {
    if (!sunriseUtc || !sunsetUtc) {
      return null;
    }

    const dayMs = sunsetUtc.getTime() - sunriseUtc.getTime();

    if (!Number.isFinite(dayMs) || dayMs <= 0) {
      return null;
    }

    const weekdayIndex: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const dayIndex = weekdayIndex[localCivilWeekday];

    if (dayIndex === undefined) {
      return null;
    }

    const eighthMs = dayMs / 8;
    const muhurtaMs = dayMs / 15;

    const eighthWindow = (segment: number) => {
      const start = new Date(sunriseUtc.getTime() + eighthMs * (segment - 1));
      const end = new Date(sunriseUtc.getTime() + eighthMs * segment);

      return {
        start: this.formatLocalAstronomyTime(start, timezoneName, timezone),
        end: this.formatLocalAstronomyTime(end, timezoneName, timezone),
      };
    };

    const muhurtaWindow = (segment: number) => {
      const start = new Date(sunriseUtc.getTime() + muhurtaMs * (segment - 1));
      const end = new Date(sunriseUtc.getTime() + muhurtaMs * segment);

      return {
        start: this.formatLocalAstronomyTime(start, timezoneName, timezone),
        end: this.formatLocalAstronomyTime(end, timezoneName, timezone),
      };
    };

    // Sunday -> Saturday traditional daytime eighth divisions.
    const rahuSegments = [8, 2, 7, 5, 6, 4, 3];
    const yamagandaSegments = [5, 4, 3, 2, 1, 7, 6];
    const gulikaSegments = [7, 6, 5, 4, 3, 2, 1];

    const solarNoonMs = sunriseUtc.getTime() + dayMs / 2;

    const abhijitHalfMs = muhurtaMs / 2;

    const abhijit = {
      start: this.formatLocalAstronomyTime(
        new Date(solarNoonMs - abhijitHalfMs),
        timezoneName,
        timezone,
      ),
      end: this.formatLocalAstronomyTime(
        new Date(solarNoonMs + abhijitHalfMs),
        timezoneName,
        timezone,
      ),
    };

    return {
      auspicious: {
        abhijit,
      },
      inauspicious: {
        dushtaMuhurtas: muhurtaWindow(14),
        kantakaMrityu: muhurtaWindow(6),
        yamaghanta: muhurtaWindow(9),
        rahuKaal: eighthWindow(rahuSegments[dayIndex]),
        kulika: muhurtaWindow(14),
        kalavela: muhurtaWindow(8),
        yamaganda: eighthWindow(yamagandaSegments[dayIndex]),
        gulikaKaal: eighthWindow(gulikaSegments[dayIndex]),
      },
      basis: {
        sunrise: this.formatLocalAstronomyTime(
          sunriseUtc,
          timezoneName,
          timezone,
        ),
        sunset: this.formatLocalAstronomyTime(
          sunsetUtc,
          timezoneName,
          timezone,
        ),
        weekday: localCivilWeekday,
      },
    };
  }
  private calculateRituFromSiderealSun(sunSignNumber: number): string {
    switch (sunSignNumber) {
      case 12:
      case 1:
        return 'Vasanta';

      case 2:
      case 3:
        return 'Grishma';

      case 4:
      case 5:
        return 'Varsha';

      case 6:
      case 7:
        return 'Sharad';

      case 8:
      case 9:
        return 'Hemanta';

      case 10:
      case 11:
        return 'Shishira';

      default:
        throw new Error(
          `Invalid sidereal Sun sign number for Ritu: ${sunSignNumber}`,
        );
    }
  }
  private calculateLocalBodyEventUtc(
    body: typeof Body.Sun | typeof Body.Moon,
    direction: 1 | -1,
    year: number,
    month: number,
    day: number,
    latitude: number,
    longitude: number,
    timezoneName?: string,
    timezone?: number,
  ): Date | null {
    let localMidnightUtc: Date;

    if (timezoneName) {
      localMidnightUtc = this.localCivilTimeToUtc(
        year,
        month,
        day,
        0,
        0,
        0,
        timezoneName,
      ).utcDate;
    } else {
      const offsetHours = Number.isFinite(timezone) ? Number(timezone) : 0;

      localMidnightUtc = new Date(
        Date.UTC(year, month - 1, day, 0, 0, 0) - offsetHours * 60 * 60 * 1000,
      );
    }

    const observer = new Observer(latitude, longitude, 0);

    const event = SearchRiseSet(body, observer, direction, localMidnightUtc, 1);

    return event?.date ?? null;
  }

  private formatLocalAstronomyTime(
    instant: Date | null,
    timezoneName?: string,
    timezone?: number,
  ): string | null {
    if (!instant) {
      return null;
    }

    if (timezoneName) {
      try {
        return new Intl.DateTimeFormat('en-US', {
          timeZone: timezoneName,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(instant);
      } catch {
        // Numeric timezone fallback below.
      }
    }

    const offsetHours = Number.isFinite(timezone) ? Number(timezone) : 0;

    const shifted = new Date(instant.getTime() + offsetHours * 60 * 60 * 1000);

    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(shifted);
  }
  private calculateLocalSunriseUtc(
    localYear: number,
    localMonth: number,
    localDay: number,
    latitude: number,
    longitude: number,
    timezoneName?: string,
    timezone?: number,
  ): Date {
    let localMidnightUtc: Date;

    const zone = timezoneName?.trim();

    if (zone) {
      localMidnightUtc = this.localCivilTimeToUtc(
        localYear,
        localMonth,
        localDay,
        0,
        0,
        0,
        zone,
      ).utcDate;
    } else {
      const localMidnightAsUtc = Date.UTC(
        localYear,
        localMonth - 1,
        localDay,
        0,
        0,
        0,
      );

      localMidnightUtc = new Date(
        localMidnightAsUtc - (timezone ?? 0) * 60 * 60 * 1000,
      );
    }

    const observer = new Observer(latitude, longitude, 0);

    const rise = SearchRiseSet(Body.Sun, observer, +1, localMidnightUtc, 1);

    if (!rise) {
      throw new Error('Sunrise is unavailable for this location/date.');
    }

    return rise.date;
  }

  constructor(
    private readonly interpretation: GeneralHoroscopeInterpretationService,
  ) {}
  private parseDate(date?: string): Date {
    if (!date) return new Date();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('date must use YYYY-MM-DD format');
    }

    const parsed = new Date(`${date}T12:00:00.000Z`);

    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid date');
    }

    return parsed;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addUtcDays(date: Date, days: number): Date {
    const result = new Date(date.getTime());
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }

  private startOfIsoWeek(date: Date): Date {
    const result = new Date(date.getTime());
    const day = result.getUTCDay();
    const distanceFromMonday = day === 0 ? 6 : day - 1;
    result.setUTCDate(result.getUTCDate() - distanceFromMonday);
    return result;
  }

  private transitSnapshot(date: Date) {
    const transit = calculateVedicTransit(date);

    return {
      date: this.formatDate(date),
      calculatedAt: transit.calculatedAt,
      planets: transit.planets,
      zodiac: transit.zodiac,
      ayanamsha: transit.ayanamsha,
      calculation: transit.calculation,
    };
  }
  private periodMoonSignEvidence(
    snapshots: Array<ReturnType<GeneralHoroscopeService['transitSnapshot']>>,
    moonSignNumber: number,
  ) {
    return snapshots.map((snapshot) => ({
      date: snapshot.date,
      planets: snapshot.planets.map((planet) => ({
        name: planet.name,
        sign: planet.sign,
        nakshatra: planet.nakshatra,
        pada: planet.pada,
        retrograde: planet.retrograde,
        houseFromMoon: ((planet.sign_no - moonSignNumber + 12) % 12) + 1,
      })),
    }));
  }
  private normalizeMoonSign(moonSign: string) {
    const normalized = moonSign.trim().toLowerCase();

    const index = RASHIS.findIndex((sign) => sign.toLowerCase() === normalized);

    if (index < 0) {
      throw new Error(
        `Invalid moonSign. Expected one of: ${RASHIS.join(', ')}`,
      );
    }

    return {
      name: RASHIS[index],
      number: index + 1,
    };
  }

  private transitFor(date?: string): LocalVedicTransit {
    return calculateVedicTransit(this.parseDate(date));
  }

  private moonSignTransitEvidence(
    transit: LocalVedicTransit,
    moonSignNumber: number,
  ) {
    return transit.planets.map((planet) => {
      const houseFromMoon = ((planet.sign_no - moonSignNumber + 12) % 12) + 1;

      return {
        name: planet.name,
        longitude: planet.longitude,
        sign: planet.sign,
        sign_no: planet.sign_no,
        degree: planet.degree,
        nakshatra: planet.nakshatra,
        pada: planet.pada,
        retrograde: planet.retrograde,
        houseFromMoon,
      };
    });
  }

  private calculateDailyRatings(
    transit: LocalVedicTransit,
    moonSignNumber: number,
  ) {
    const evidence = this.moonSignTransitEvidence(transit, moonSignNumber);

    const houseOf = (planetName: string): number | null => {
      const planet = evidence.find((item) => item.name === planetName);

      return planet?.houseFromMoon ?? null;
    };

    /*
     * ASP General Horoscope Rating v1
     *
     * Deterministic Moon-sign transit index.
     * Input is exclusively the locally calculated sidereal transit.
     *
     * This is a product interpretation index, not a measured probability.
     * No AI, randomness, user hardcoding or fabricated provider score.
     */

    const favorableHouses: Record<string, readonly number[]> = {
      Sun: [3, 6, 10, 11],
      Moon: [1, 3, 6, 7, 10, 11],
      Mars: [3, 6, 11],
      Mercury: [2, 4, 6, 8, 10, 11],
      Jupiter: [2, 5, 7, 9, 11],
      Venus: [1, 2, 3, 4, 5, 8, 9, 11, 12],
      Saturn: [3, 6, 11],
      Rahu: [3, 6, 10, 11],
      Ketu: [3, 6, 10, 11],
    };

    const planetSignal = (planetName: string): number => {
      const house = houseOf(planetName);

      if (house === null) {
        return 0;
      }

      return favorableHouses[planetName]?.includes(house) ? 1 : -1;
    };

    const categoryScore = (
      weightedPlanets: ReadonlyArray<readonly [string, number]>,
    ): number => {
      let weightedSignal = 0;
      let totalWeight = 0;

      for (const [planetName, weight] of weightedPlanets) {
        weightedSignal += planetSignal(planetName) * weight;
        totalWeight += weight;
      }

      if (totalWeight <= 0) {
        return 3;
      }

      const normalized = weightedSignal / totalWeight;

      if (normalized >= 0.6) return 5;
      if (normalized >= 0.2) return 4;
      if (normalized > -0.2) return 3;
      if (normalized > -0.6) return 2;

      return 1;
    };

    const ratings = {
      health: categoryScore([
        ['Sun', 3],
        ['Moon', 2],
        ['Mars', 2],
        ['Saturn', 1],
      ]),
      wealth: categoryScore([
        ['Jupiter', 3],
        ['Venus', 2],
        ['Mercury', 2],
        ['Sun', 1],
      ]),
      family: categoryScore([
        ['Moon', 3],
        ['Jupiter', 2],
        ['Venus', 2],
        ['Mercury', 1],
      ]),
      loveMatters: categoryScore([
        ['Venus', 4],
        ['Moon', 2],
        ['Jupiter', 1],
        ['Mars', 1],
      ]),
      occupation: categoryScore([
        ['Sun', 2],
        ['Mercury', 3],
        ['Saturn', 2],
        ['Jupiter', 1],
      ]),
      marriedLife: categoryScore([
        ['Venus', 3],
        ['Jupiter', 3],
        ['Moon', 1],
        ['Mars', 1],
      ]),
    };

    return {
      scale: 5,
      methodology: 'moon-sign-transit-v1',
      ratings,
      evidence: evidence.map((planet) => ({
        planet: planet.name,
        sign: planet.sign,
        houseFromMoon: planet.houseFromMoon,
        retrograde: planet.retrograde,
      })),
    };
  }

  async daily(moonSign: string, date?: string, lang = 'en') {
    const sign = this.normalizeMoonSign(moonSign);
    const transit = this.transitFor(date);
    const moonSignTransit = this.moonSignTransitEvidence(transit, sign.number);

    const interpretation = await this.interpretation.generateDaily({
      moonSign: sign.name,
      date: transit.calculatedAt.slice(0, 10),
      languageCode: lang,
      evidence: moonSignTransit,
    });

    return {
      access: 'free',
      personalized: false,
      period: 'daily',
      language: lang,
      moonSign: sign,
      date: transit.calculatedAt.slice(0, 10),
      transit,
      moonSignTransit,
      interpretation: {
        summary: interpretation.summary,
        advice: interpretation.advice,
        language: interpretation.language,
      },
      todayRating: this.calculateDailyRatings(transit, sign.number),
      engine: {
        zodiac: transit.zodiac,
        ayanamsha: transit.ayanamsha,
        calculation: transit.calculation,
      },
    };
  }

  async weekly(moonSign: string, date?: string, lang = 'en') {
    const sign = this.normalizeMoonSign(moonSign);
    const requestedDate = this.parseDate(date);
    const start = this.startOfIsoWeek(requestedDate);

    const snapshots = Array.from({ length: 7 }, (_, index) =>
      this.transitSnapshot(this.addUtcDays(start, index)),
    );

    const startDate = this.formatDate(start);
    const endDate = this.formatDate(this.addUtcDays(start, 6));

    const moonSignEvidence = this.periodMoonSignEvidence(
      snapshots,
      sign.number,
    );

    const interpretation = await this.interpretation.generatePeriod({
      period: 'weekly',
      moonSign: sign.name,
      startDate,
      endDate,
      languageCode: lang,
      evidence: moonSignEvidence,
    });

    return {
      access: 'free',
      personalized: false,
      period: 'weekly',
      language: lang,
      moonSign: sign,
      startDate,
      endDate,
      snapshots,
      moonSignEvidence,
      interpretation: {
        summary: interpretation.summary,
        advice: interpretation.advice,
        language: interpretation.language,
      },
      engine: {
        source: 'local-vedic-transit',
        snapshotCount: snapshots.length,
      },
    };
  }

  async weeklyLove(moonSign: string, date?: string, lang = 'en') {
    const sign = this.normalizeMoonSign(moonSign);
    const requestedDate = this.parseDate(date);
    const start = this.startOfIsoWeek(requestedDate);

    const snapshots = Array.from({ length: 7 }, (_, index) =>
      this.transitSnapshot(this.addUtcDays(start, index)),
    );

    const startDate = this.formatDate(start);
    const endDate = this.formatDate(this.addUtcDays(start, 6));

    const moonSignEvidence = this.periodMoonSignEvidence(
      snapshots,
      sign.number,
    );

    const interpretation = await this.interpretation.generatePeriod({
      period: 'weekly-love',
      moonSign: sign.name,
      startDate,
      endDate,
      languageCode: lang,
      evidence: moonSignEvidence,
    });

    return {
      access: 'free',
      personalized: false,
      period: 'weekly-love',
      focus: 'relationships',
      language: lang,
      moonSign: sign,
      startDate,
      endDate,
      snapshots,
      moonSignEvidence,
      interpretation: {
        summary: interpretation.summary,
        advice: interpretation.advice,
        language: interpretation.language,
      },
      engine: {
        source: 'local-vedic-transit',
        snapshotCount: snapshots.length,
      },
    };
  }

  async monthly(moonSign: string, date?: string, lang = 'en') {
    const sign = this.normalizeMoonSign(moonSign);
    const requestedDate = this.parseDate(date);

    const year = requestedDate.getUTCFullYear();
    const month = requestedDate.getUTCMonth();

    const start = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));

    const sampleDays = [1, 8, 15, 22, end.getUTCDate()].filter(
      (day, index, values) => values.indexOf(day) === index,
    );

    const snapshots = sampleDays.map((day) =>
      this.transitSnapshot(new Date(Date.UTC(year, month, day, 12, 0, 0))),
    );

    const startDate = this.formatDate(start);
    const endDate = this.formatDate(end);

    const moonSignEvidence = this.periodMoonSignEvidence(
      snapshots,
      sign.number,
    );

    const interpretation = await this.interpretation.generatePeriod({
      period: 'monthly',
      moonSign: sign.name,
      startDate,
      endDate,
      languageCode: lang,
      evidence: moonSignEvidence,
    });

    return {
      access: 'free',
      personalized: false,
      period: 'monthly',
      language: lang,
      moonSign: sign,
      startDate,
      endDate,
      snapshots,
      moonSignEvidence,
      interpretation: {
        summary: interpretation.summary,
        advice: interpretation.advice,
        language: interpretation.language,
      },
      engine: {
        source: 'local-vedic-transit',
        snapshotCount: snapshots.length,
      },
    };
  }

  async yearly(moonSign: string, date?: string, lang = 'en') {
    const sign = this.normalizeMoonSign(moonSign);
    const requestedDate = this.parseDate(date);
    const year = requestedDate.getUTCFullYear();

    const snapshots = Array.from({ length: 12 }, (_, month) =>
      this.transitSnapshot(new Date(Date.UTC(year, month, 15, 12, 0, 0))),
    );

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const moonSignEvidence = this.periodMoonSignEvidence(
      snapshots,
      sign.number,
    );

    const interpretation = await this.interpretation.generatePeriod({
      period: 'yearly',
      moonSign: sign.name,
      startDate,
      endDate,
      languageCode: lang,
      evidence: moonSignEvidence,
    });

    return {
      access: 'free',
      personalized: false,
      period: 'yearly',
      language: lang,
      moonSign: sign,
      year,
      startDate,
      endDate,
      snapshots,
      moonSignEvidence,
      interpretation: {
        summary: interpretation.summary,
        advice: interpretation.advice,
        language: interpretation.language,
      },
      engine: {
        source: 'local-vedic-transit',
        snapshotCount: snapshots.length,
      },
    };
  }

  /**
   * Converts a local civil date/time in an IANA timezone to its UTC instant.
   *
   * Example:
   *   2026-09-25 12:00 America/Denver -> UTC using the offset that applies
   *   specifically on 2026-09-25, including DST where applicable.
   *
   * No country-specific or fixed timezone offset is hardcoded here.
   */
  private calculatePanchangAtInstant(instant: Date) {
    const transit = calculateVedicTransit(instant);

    const sun = transit.planets.find((planet) => planet.name === 'Sun');
    const moon = transit.planets.find((planet) => planet.name === 'Moon');

    if (!sun || !moon) {
      throw new Error('Sun/Moon transit unavailable for Panchang transition');
    }

    return calculatePanchang(sun.longitude, moon.longitude, instant);
  }

  private getPanchangComponentNumber(
    instant: Date,
    component: 'tithi' | 'nakshatra' | 'karana' | 'yoga',
  ): number {
    return this.calculatePanchangAtInstant(instant)[component].number;
  }

  private findPanchangTransitionUtc(
    fromUtc: Date,
    component: 'tithi' | 'nakshatra' | 'karana' | 'yoga',
  ): Date | null {
    const initialNumber = this.getPanchangComponentNumber(fromUtc, component);

    const startMs = fromUtc.getTime();

    // Coarse real-engine search every 30 minutes.
    const stepMs = 30 * 60 * 1000;
    const maxMs = 48 * 60 * 60 * 1000;

    let lowerMs = startMs;
    let upperMs: number | null = null;

    for (
      let probeMs = startMs + stepMs;
      probeMs <= startMs + maxMs;
      probeMs += stepMs
    ) {
      const probeNumber = this.getPanchangComponentNumber(
        new Date(probeMs),
        component,
      );

      if (probeNumber !== initialNumber) {
        lowerMs = probeMs - stepMs;
        upperMs = probeMs;
        break;
      }
    }

    if (upperMs === null) {
      return null;
    }

    // Binary refinement to within 30 seconds.
    while (upperMs - lowerMs > 30 * 1000) {
      const middleMs = Math.floor((lowerMs + upperMs) / 2);

      const middleNumber = this.getPanchangComponentNumber(
        new Date(middleMs),
        component,
      );

      if (middleNumber === initialNumber) {
        lowerMs = middleMs;
      } else {
        upperMs = middleMs;
      }
    }

    return new Date(upperMs);
  }

  private formatPanchangTransitionTime(
    instant: Date | null,
    timezoneName?: string,
    timezone?: number,
  ): string | null {
    if (!instant) {
      return null;
    }

    const zone = timezoneName?.trim();

    if (zone) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(instant);
    }

    if (timezone !== undefined && Number.isFinite(timezone)) {
      const localDate = new Date(instant.getTime() + timezone * 60 * 60 * 1000);

      let hour = localDate.getUTCHours();
      const minute = localDate.getUTCMinutes();

      const suffix = hour >= 12 ? 'PM' : 'AM';

      hour %= 12;

      if (hour === 0) {
        hour = 12;
      }

      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(
        2,
        '0',
      )} ${suffix}`;
    }

    return instant.toISOString();
  }
  private buildDailyPanchangSequence(
    dayStartUtc: Date,
    timezoneName?: string,
    timezone?: number,
  ) {
    const startPanchang = this.calculatePanchangAtInstant(dayStartUtc);

    const nakshatraEndUtc = this.findPanchangTransitionUtc(
      dayStartUtc,
      'nakshatra',
    );

    const firstKaranaEndUtc = this.findPanchangTransitionUtc(
      dayStartUtc,
      'karana',
    );

    const secondKaranaStartUtc = firstKaranaEndUtc
      ? new Date(firstKaranaEndUtc.getTime() + 60 * 1000)
      : null;

    const secondKaranaPanchang = secondKaranaStartUtc
      ? this.calculatePanchangAtInstant(secondKaranaStartUtc)
      : null;

    const secondKaranaEndUtc = secondKaranaStartUtc
      ? this.findPanchangTransitionUtc(secondKaranaStartUtc, 'karana')
      : null;

    return {
      nakshatra: {
        ...startPanchang.nakshatra,
        endTime: this.formatPanchangTransitionTime(
          nakshatraEndUtc,
          timezoneName,
          timezone,
        ),
        endUtc: nakshatraEndUtc?.toISOString() ?? null,
      },

      karanas: [
        {
          ...startPanchang.karana,
          endTime: this.formatPanchangTransitionTime(
            firstKaranaEndUtc,
            timezoneName,
            timezone,
          ),
          endUtc: firstKaranaEndUtc?.toISOString() ?? null,
        },

        ...(secondKaranaPanchang
          ? [
              {
                ...secondKaranaPanchang.karana,
                endTime: this.formatPanchangTransitionTime(
                  secondKaranaEndUtc,
                  timezoneName,
                  timezone,
                ),
                endUtc: secondKaranaEndUtc?.toISOString() ?? null,
              },
            ]
          : []),
      ],
    };
  }
  private localCivilTimeToUtc(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timezoneName: string,
  ): { utcDate: Date; offsetHours: number } {
    const zone = timezoneName.trim();

    if (!zone) {
      throw new Error('IANA timezone name is required.');
    }

    try {
      // Validate the supplied IANA timezone before calculation.
      new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
      }).format(new Date());
    } catch {
      throw new Error(`Invalid IANA timezone: ${zone}`);
    }

    const desiredLocalAsUtc = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second,
    );

    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const localPartsAt = (instantMs: number) => {
      const parts = formatter.formatToParts(new Date(instantMs));

      const read = (type: Intl.DateTimeFormatPartTypes): number => {
        const value = parts.find((part) => part.type === type)?.value;

        if (value === undefined) {
          throw new Error(`Unable to resolve ${type} for timezone ${zone}.`);
        }

        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
          throw new Error(`Invalid ${type} returned for timezone ${zone}.`);
        }

        return parsed;
      };

      return Date.UTC(
        read('year'),
        read('month') - 1,
        read('day'),
        read('hour'),
        read('minute'),
        read('second'),
      );
    };

    // First estimate treats the requested wall-clock components as UTC.
    // Then correct using the zone's offset at the resulting instant.
    let utcMs = desiredLocalAsUtc;

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const representedLocalMs = localPartsAt(utcMs);
      const correctionMs = desiredLocalAsUtc - representedLocalMs;

      if (correctionMs === 0) {
        break;
      }

      utcMs += correctionMs;
    }

    const representedLocalMs = localPartsAt(utcMs);

    if (representedLocalMs !== desiredLocalAsUtc) {
      throw new Error(
        `Unable to resolve local civil time in timezone ${zone}.`,
      );
    }

    const offsetHours = (representedLocalMs - utcMs) / (60 * 60 * 1000);

    if (
      !Number.isFinite(offsetHours) ||
      offsetHours < -14 ||
      offsetHours > 14
    ) {
      throw new Error(`Resolved timezone offset is invalid for ${zone}.`);
    }

    return {
      utcDate: new Date(utcMs),
      offsetHours,
    };
  }
  panchang(
    date?: string,
    lang = 'en',
    latitude?: number,
    longitude?: number,
    timezone?: number,
    timezoneName?: string,
    place?: string,
  ) {
    const requestedDate = this.parseDate(date);
    const dateKey = this.formatDate(requestedDate);

    const hasLocation =
      latitude !== undefined ||
      longitude !== undefined ||
      timezone !== undefined ||
      Boolean(timezoneName?.trim()) ||
      Boolean(place?.trim());

    if (hasLocation) {
      if (
        latitude === undefined ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      ) {
        throw new Error('Latitude must be between -90 and 90.');
      }

      if (
        longitude === undefined ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        throw new Error('Longitude must be between -180 and 180.');
      }

      if (
        timezone === undefined ||
        !Number.isFinite(timezone) ||
        timezone < -12 ||
        timezone > 14
      ) {
        throw new Error('Timezone must be between -12 and +14 hours.');
      }
    }

    /*
     * Panchang snapshot is calculated for 12:00 local civil time.
     *
     * The selected location's timezone offset converts that local time
     * into the UTC instant consumed by the existing Vedic transit engine.
     *
     * No India/IST assumption is made here.
     */
    let utcDate = requestedDate;
    let effectiveTimezone = timezone;

    if (hasLocation) {
      const [year, month, day] = dateKey.split('-').map(Number);
      const zone = timezoneName?.trim();

      if (zone) {
        const resolved = this.localCivilTimeToUtc(
          year,
          month,
          day,
          12,
          0,
          0,
          zone,
        );

        utcDate = resolved.utcDate;
        effectiveTimezone = resolved.offsetHours;
      } else {
        // Backward-compatible fallback when an IANA timezone is unavailable.
        // The preferred worldwide path is always timezoneName above.
        const localNoonAsUtc = Date.UTC(year, month - 1, day, 12, 0, 0);

        utcDate = new Date(
          localNoonAsUtc - (timezone as number) * 60 * 60 * 1000,
        );
      }
    }

    let panchangCalculationUtc = utcDate;

    if (hasLocation && latitude !== undefined && longitude !== undefined) {
      const [sunriseYear, sunriseMonth, sunriseDay] = dateKey
        .split('-')
        .map(Number);

      panchangCalculationUtc = this.calculateLocalSunriseUtc(
        sunriseYear,
        sunriseMonth,
        sunriseDay,
        latitude,
        longitude,
        timezoneName,
        effectiveTimezone,
      );
    }

    const transit = calculateVedicTransit(panchangCalculationUtc);

    const sun = transit.planets.find((planet) => planet.name === 'Sun');
    const moon = transit.planets.find((planet) => planet.name === 'Moon');

    if (!sun || !moon) {
      throw new Error('Sun/Moon transit unavailable for Panchang');
    }

    const calculatedPanchang = calculatePanchang(
      sun.longitude,
      moon.longitude,
      panchangCalculationUtc,
    );

    // Find the next real astronomical boundary for each Panchang element.
    // These values are derived from repeated calls to the same Vedic
    // transit/Panchang engine; no reference-app or random timings are used.
    const tithiEndUtc = this.findPanchangTransitionUtc(
      panchangCalculationUtc,
      'tithi',
    );
    const nakshatraEndUtc = this.findPanchangTransitionUtc(
      utcDate,
      'nakshatra',
    );
    const karanaEndUtc = this.findPanchangTransitionUtc(
      panchangCalculationUtc,
      'karana',
    );
    const yogaEndUtc = this.findPanchangTransitionUtc(
      panchangCalculationUtc,
      'yoga',
    );

    const panchangTimings = {
      tithiEnd: this.formatPanchangTransitionTime(
        tithiEndUtc,
        timezoneName,
        effectiveTimezone,
      ),
      nakshatraEnd: this.formatPanchangTransitionTime(
        nakshatraEndUtc,
        timezoneName,
        effectiveTimezone,
      ),
      karanaEnd: this.formatPanchangTransitionTime(
        karanaEndUtc,
        timezoneName,
        effectiveTimezone,
      ),
      yogaEnd: this.formatPanchangTransitionTime(
        yogaEndUtc,
        timezoneName,
        effectiveTimezone,
      ),
    };

    // Panchang calculations above still use the real UTC instant.
    // Only the displayed weekday belongs to the selected local civil date.
    const [localYear, localMonth, localDay] = dateKey.split('-').map(Number);

    const localCivilWeekday = new Date(
      Date.UTC(localYear, localMonth - 1, localDay, 12, 0, 0),
    ).toLocaleDateString('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    });

    let dailySequenceStartUtc: Date;

    if (hasLocation) {
      const zone = timezoneName?.trim();

      if (zone) {
        const resolvedMidnight = this.localCivilTimeToUtc(
          localYear,
          localMonth,
          localDay,
          0,
          0,
          0,
          zone,
        );

        dailySequenceStartUtc = resolvedMidnight.utcDate;
      } else {
        // Backward-compatible fallback only when an IANA timezone is unavailable.
        // New worldwide city selections should use timezoneName.
        const localMidnightAsUtc = Date.UTC(
          localYear,
          localMonth - 1,
          localDay,
          0,
          0,
          0,
        );

        dailySequenceStartUtc = new Date(
          localMidnightAsUtc - (timezone as number) * 60 * 60 * 1000,
        );
      }
    } else {
      dailySequenceStartUtc = new Date(
        Date.UTC(
          utcDate.getUTCFullYear(),
          utcDate.getUTCMonth(),
          utcDate.getUTCDate(),
          0,
          0,
          0,
        ),
      );
    }

    const dailyPanchangSequence = this.buildDailyPanchangSequence(
      dailySequenceStartUtc,
      timezoneName,
      timezone,
    );
    let sunMoon: {
      sunrise: string | null;
      sunset: string | null;
      moonrise: string | null;
      moonset: string | null;
      moonSign: string | null;
      ritu: string | null;
    } | null = null;
    let hinduDayDuration: string | null = null;
    let auspiciousInauspiciousTimings: ReturnType<
      GeneralHoroscopeService['calculateAuspiciousInauspiciousTimings']
    > = null;

    if (hasLocation && latitude !== undefined && longitude !== undefined) {
      const [eventYear, eventMonth, eventDay] = dateKey
        .split('-')
        .map((value) => Number(value));

      const sunriseUtc = this.calculateLocalBodyEventUtc(
        Body.Sun,
        +1,
        eventYear,
        eventMonth,
        eventDay,
        latitude,
        longitude,
        timezoneName,
        effectiveTimezone,
      );

      const sunsetUtc = this.calculateLocalBodyEventUtc(
        Body.Sun,
        -1,
        eventYear,
        eventMonth,
        eventDay,
        latitude,
        longitude,
        timezoneName,
        effectiveTimezone,
      );

      const moonriseUtc = this.calculateLocalBodyEventUtc(
        Body.Moon,
        +1,
        eventYear,
        eventMonth,
        eventDay,
        latitude,
        longitude,
        timezoneName,
        effectiveTimezone,
      );

      const moonsetUtc = this.calculateLocalBodyEventUtc(
        Body.Moon,
        -1,
        eventYear,
        eventMonth,
        eventDay,
        latitude,
        longitude,
        timezoneName,
        effectiveTimezone,
      );
      hinduDayDuration = this.calculateDayDuration(sunriseUtc, sunsetUtc);

      auspiciousInauspiciousTimings =
        this.calculateAuspiciousInauspiciousTimings(
          sunriseUtc,
          sunsetUtc,
          localCivilWeekday,
          timezoneName,
          effectiveTimezone,
        );

      const sun = transit.planets.find((planet) => planet.name === 'Sun');
      const moon = transit.planets.find((planet) => planet.name === 'Moon');

      if (!sun) {
        throw new Error('Sidereal Sun unavailable for Ritu calculation.');
      }

      sunMoon = {
        sunrise: this.formatLocalAstronomyTime(
          sunriseUtc,
          timezoneName,
          effectiveTimezone,
        ),
        sunset: this.formatLocalAstronomyTime(
          sunsetUtc,
          timezoneName,
          effectiveTimezone,
        ),
        moonrise: this.formatLocalAstronomyTime(
          moonriseUtc,
          timezoneName,
          effectiveTimezone,
        ),
        moonset: this.formatLocalAstronomyTime(
          moonsetUtc,
          timezoneName,
          effectiveTimezone,
        ),
        moonSign: moon?.sign ?? null,
        ritu: this.calculateRituFromSiderealSun(sun.sign_no),
      };
    }
    const hinduLunarYear = this.calculateHinduLunarYear(panchangCalculationUtc);

    const hinduMonthAndYear = {
      lunarMonth: this.calculateAmantaHinduMonth(panchangCalculationUtc),
      purnimantaMonth: this.calculatePurnimantaHinduMonth(
        panchangCalculationUtc,
      ),
      lunarYear: hinduLunarYear,
      samvatsara: this.calculateSamvatsaraName(hinduLunarYear.vikramSamvat),
      kaliSamvat: this.calculateKaliSamvat(hinduLunarYear.vikramSamvat),
      dayDuration: hinduDayDuration,
    };

    const locationCorrectPanchang = {
      ...calculatedPanchang,
      day: {
        ...calculatedPanchang.day,
        name: localCivilWeekday,
      },
      paksha: calculatedPanchang.tithi.type,

      nakshatra: calculatedPanchang.nakshatra,

      karana: dailyPanchangSequence.karanas[0] ?? calculatedPanchang.karana,

      karanas: dailyPanchangSequence.karanas,

      timings: {
        ...panchangTimings,

        nakshatraEnd: this.formatPanchangTransitionTime(
          this.findPanchangTransitionUtc(panchangCalculationUtc, 'nakshatra'),
          timezoneName,
          effectiveTimezone,
        ),

        karanaEnd:
          dailyPanchangSequence.karanas[0]?.endTime ??
          panchangTimings.karanaEnd,

        karanaEnds: dailyPanchangSequence.karanas.map((item) => item.endTime),
      },
    };

    return {
      access: 'free',
      personalized: false,
      period: 'panchang',
      language: lang,
      date: dateKey,

      location: hasLocation
        ? {
            place: place?.trim() || null,
            latitude,
            longitude,
            timezone: effectiveTimezone,
            timezoneName: timezoneName?.trim() || null,
          }
        : null,

      calculationTime: {
        localTime: hasLocation ? '12:00:00' : null,
        utc: utcDate.toISOString(),
      },

      panchang: locationCorrectPanchang,
      sunMoon,
      hinduMonthAndYear,
      auspiciousInauspiciousTimings,
      dishaShoola: this.calculateDishaShoola(localCivilWeekday),

      chandrabalamTarabalam: this.calculateGeneralBalaLists(
        calculatedPanchang.nakshatra.name,
        moon?.sign ?? null,
      ),
      engine: {
        source: 'local-vedic-transit',
        panchangSource: 'sun-moon-sidereal-longitude',
        locationAware: hasLocation,
        timezoneAware: hasLocation,
        calculation: transit.calculation,
      },
    };
  }
}
