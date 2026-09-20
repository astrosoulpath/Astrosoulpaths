import { calculateAshtakavarga } from '../engine/ashtakavarga.util';
import { Injectable } from '@nestjs/common';
import * as Astronomy from 'astronomy-engine';

import { AstroParams } from '../../../common/types/astro-params.type';
import { KundliReport } from '../types/kundli-report.type';
import { IKundliProvider } from './interfaces/kundli-provider.interface';

import { birthParamsToUtc } from '../engine/vedic-time.util';
import { calculatePlanetPositions } from '../engine/planetary-position.util';
import { calculateSiderealAscendant } from '../engine/ascendant.util';
import { mapSiderealLongitude } from '../engine/vedic-position.util';
import { calculateWholeSignHouse } from '../engine/vedic-house.util';
import { calculateNavamsaPosition } from '../engine/navamsa.util';
import { calculateLunarNodes } from '../engine/lunar-node.util';
import { isPlanetRetrograde } from '../engine/retrograde.util';
import { calculateVimshottariDasha } from '../engine/vimshottari-dasha.util';
import { calculatePanchang } from '../engine/panchang.util';
import { calculateMangalDosha } from '../engine/mangal-dosha.util';
import { calculateNatalYogas } from '../engine/natal-yoga.util';
import { calculateSadeSati } from '../engine/sade-sati.util';
import { calculateVedicTransit } from '../engine/vedic-transit.util';
import { calculateGemstoneSuggestion } from '../engine/gemstone-suggestion.util';

@Injectable()
export class LocalVedicKundliProvider implements IKundliProvider {
  async generate(
    params: AstroParams,
    lang = 'en',
  ): Promise<KundliReport> {
    const utcDate = birthParamsToUtc(params);

    const ascendantLongitude =
      calculateSiderealAscendant(
        utcDate,
        params.lat,
        params.lon,
      );

    const ascendant =
      mapSiderealLongitude(ascendantLongitude);

    const calculatedPlanets =
      calculatePlanetPositions(utcDate);

    const bodyMap: Record<string, Astronomy.Body> = {
      Sun: Astronomy.Body.Sun,
      Moon: Astronomy.Body.Moon,
      Mercury: Astronomy.Body.Mercury,
      Venus: Astronomy.Body.Venus,
      Mars: Astronomy.Body.Mars,
      Jupiter: Astronomy.Body.Jupiter,
      Saturn: Astronomy.Body.Saturn,
    };

    const planets = calculatedPlanets.map((planet) => {
      const vedic =
        mapSiderealLongitude(
          planet.siderealLongitude,
        );

      const body = bodyMap[planet.name];

      if (!body) {
        throw new Error(
          `Unsupported local planet: ${planet.name}`,
        );
      }

      return {
        name: planet.name,
        full_name: planet.name,
        longitude: vedic.longitude,
        absolute_degree: vedic.longitude,
        degree: vedic.degree,
        degree_in_sign: vedic.degree_in_sign,
        sign: vedic.sign,
        zodiac: vedic.sign,
        sign_no: vedic.sign_no,
        rasi_no: vedic.rasi_no,
        nakshatra: vedic.nakshatra,
        nakshatra_number:
          vedic.nakshatra_number,
        nakshatra_pada:
          vedic.nakshatra_pada,
        house: calculateWholeSignHouse(
          vedic.longitude,
          ascendantLongitude,
        ),
        retro:
          isPlanetRetrograde(
            body,
            utcDate,
          ),
      };
    });

    const moon = planets.find(
      (planet) => planet.name === 'Moon',
    );

    if (!moon) {
      throw new Error(
        'Moon position unavailable for local Vimshottari Dasha.',
      );
    }

    
const dasha = calculateVimshottariDasha(
      moon.longitude,
      utcDate,
    );

        const gemSuggestion = calculateGemstoneSuggestion(
      ascendant.sign,
      ascendant.sign_no,
    );
const transitDate = new Date();

    const sadeSati = calculateSadeSati(
      moon.longitude,
      transitDate,
    );

    const transit = calculateVedicTransit(
      transitDate,
    );

    const sun = planets.find(
      (planet) => planet.name === 'Sun',
    );

    if (!sun) {
      throw new Error(
        'Sun position unavailable for Panchang calculation.',
      );
    }

    const panchang = calculatePanchang(
      sun.longitude,
      moon.longitude,
      utcDate,
    );

            const natalYogas = calculateNatalYogas(
      planets.map((planet) => ({
        name: planet.name,
        sign_no: planet.sign_no,
        house: planet.house,
      })),
    );
const mars = planets.find(
      (planet) => planet.name === 'Mars',
    );

    if (!mars) {
      throw new Error(
        'Mars position unavailable for Mangal Dosha calculation.',
      );
    }

    const mangalDosha = calculateMangalDosha(
      mars.house,
    );
    const nodes = calculateLunarNodes(utcDate);

    for (
      const [name, longitude] of [
        ['Rahu', nodes.rahu],
        ['Ketu', nodes.ketu],
      ] as const
    ) {
      const vedic =
        mapSiderealLongitude(longitude);

      planets.push({
        name,
        full_name: name,
        longitude: vedic.longitude,
        absolute_degree: vedic.longitude,
        degree: vedic.degree,
        degree_in_sign: vedic.degree_in_sign,
        sign: vedic.sign,
        zodiac: vedic.sign,
        sign_no: vedic.sign_no,
        rasi_no: vedic.rasi_no,
        nakshatra: vedic.nakshatra,
        nakshatra_number:
          vedic.nakshatra_number,
        nakshatra_pada:
          vedic.nakshatra_pada,
        house: calculateWholeSignHouse(
          vedic.longitude,
          ascendantLongitude,
        ),
        retro: true,
      });
    }

    const d1Bodies = [
      {
        name: 'Ascendant',
        full_name: 'Ascendant',
        longitude: ascendantLongitude,
        retro: false,
      },
      ...planets.map((planet) => ({
        name: planet.name,
        full_name: planet.full_name,
        longitude: planet.longitude,
        retro: planet.retro,
      })),
    ];

    const birthChart: Record<string, unknown> = {};

    d1Bodies.forEach((body, index) => {
      const vedic =
        mapSiderealLongitude(body.longitude);

      birthChart[String(index)] = {
        name: body.name,
        zodiac: vedic.sign,
        rasi_no: vedic.rasi_no,
        house: calculateWholeSignHouse(
          body.longitude,
          ascendantLongitude,
        ),
        retro: body.retro,
        full_name: body.full_name,
        local_degree: vedic.degree_in_sign,
      };
    });

    birthChart.chart = 'D1';
    birthChart.chart_name = 'Lagna';

    const ascendantD9 =
      calculateNavamsaPosition(
        ascendantLongitude,
      );

    const navamsaChart: Record<string, unknown> = {};

    d1Bodies.forEach((body, index) => {
      const d9 =
        calculateNavamsaPosition(
          body.longitude,
        );

      navamsaChart[String(index)] = {
        name: body.name,
        zodiac: d9.sign,
        rasi_no: d9.sign_no,
        house: calculateWholeSignHouse(
          d9.longitude,
          ascendantD9.longitude,
        ),
        retro: body.retro,
        full_name: body.full_name,
        local_degree: d9.degree,
      };
    });

    navamsaChart.chart = 'D9';
    navamsaChart.chart_name = 'Navamsa';

    const ashtakavarga = calculateAshtakavarga([
      ...planets
        .filter((planet) =>
          [
            'Sun',
            'Moon',
            'Mars',
            'Mercury',
            'Jupiter',
            'Venus',
            'Saturn',
          ].includes(planet.name),
        )
        .map((planet) => ({
          name: planet.name as
            | 'Sun'
            | 'Moon'
            | 'Mars'
            | 'Mercury'
            | 'Jupiter'
            | 'Venus'
            | 'Saturn',
          sign_no: planet.sign_no,
        })),
      {
        name: 'Ascendant',
        sign_no: ascendant.sign_no,
      },
    ]);

    return {
      provider: 'local-vedic',
      language: lang,
      status: 'COMPLETE',
      completeness: {
        corePercent: 100,
      },
      generatedAt: new Date().toISOString(),

      input: {
        dob: params.dob,
        tob: params.tob,
        latitude: params.lat,
        longitude: params.lon,
        timezone: params.timezone,
        language: lang,
      },

      charts: {
        birthChart,
        navamsaChart,
        divisionalCharts: null,
      },

      birthChart,
      navamsaChart,

      planetaryPositions: planets,

      houses: null,

      ascendant: {
        longitude: ascendant.longitude,
        sign: ascendant.sign,
        sign_no: ascendant.sign_no,
        rasi_no: ascendant.rasi_no,
        degree: ascendant.degree_in_sign,
        nakshatra: ascendant.nakshatra,
        nakshatra_number:
          ascendant.nakshatra_number,
        nakshatra_pada:
          ascendant.nakshatra_pada,
        house: 1,
      },

      dasha,
      yogas: natalYogas,
      panchang,
      shadbala: null,
      ashtakavarga,
      dosha: {
        mangal: mangalDosha,
        manglik: mangalDosha,
        kaalSarp: null,
        pitra: null,
        papaSamaya: null,
      },
      extended: {
        sadeSati,
        gemSuggestion,
      },

      transit,

      metadata: {
        engine: 'astronomy-engine',
        zodiac: 'sidereal',
        ayanamsha: 'lahiri',
        houseSystem: 'whole-sign',
        calculatedUtc:
          utcDate.toISOString(),
        generatedCharts: ['D1', 'D9'],
      },
    };
  }
}











