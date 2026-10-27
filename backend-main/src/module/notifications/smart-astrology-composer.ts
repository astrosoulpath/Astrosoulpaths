import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AstroParams } from '../../common/types/astro-params.type';
import { LocalVedicKundliProvider } from '../kundli/providers/local-vedic-kundli.provider';
import { calculateNatalYogas } from '../kundli/engine/natal-yoga.util';
import { SMART_CATEGORIES, SmartCategory } from './smart-astrology.catalog';
import { localizedSmartInterpretation, LOCALIZED_SMART_VERSION } from './smart-interpretation-localization';
import { requireHoroscopeLocale } from '../subscription/horoscope-localization';

/** Internal preview only, no HTTP birth-data endpoint, persistence, AI or push. */
export async function composeSmartAstrologyPreview(params: AstroParams, category: SmartCategory, locale: string, now = new Date()) {
  if (process.env.SMART_ASTROLOGY_PREVIEW_ENABLED !== 'true')
    throw new ServiceUnavailableException('Smart astrology previews are disabled');
  requireHoroscopeLocale(locale);
  const definition = SMART_CATEGORIES.find(item=>item.id===category);
  if (!definition || (!definition.planet && category!=='yoga'))
    throw new ServiceUnavailableException('This category requires a separately verified content pipeline');
  const report = await new LocalVedicKundliProvider().generate(params, locale);
  const planets = report.planetaryPositions ?? [];
  if (report.provider !== 'local-vedic' || !planets.length) throw new ServiceUnavailableException('Verified local chart is required');
  let factors: Array<{name:string;sign:string;house:number}>;
  let interpretation: string;
  let detectedYogas: string[] = [];
  if (category === 'yoga') {
    const yogas = calculateNatalYogas(planets.map(p=>({name:p.name, sign_no:p.sign_no, house:p.house!})))
      .flatMap(group=>group.yoga_list).filter(yoga=>yoga.has_yoga);
    if (!yogas.length) throw new ServiceUnavailableException('No supported alignment detected');
    detectedYogas = yogas.map(yoga=>yoga.name);
    factors = planets.filter(p=>['Sun','Moon','Mercury','Mars','Jupiter'].includes(p.name)).map(p=>({name:p.name,sign:p.sign,house:p.house!}));
    interpretation = yogas.map(yoga=>`${yoga.name}: ${yoga.calculation}.`).join(' ') + ' These are limited traditional rules, not guaranteed outcomes.';
  } else {
    const planet = planets.find(p=>p.name===definition.planet);
    if (!planet || !Number.isInteger(planet.house) || planet.house!<1 || planet.house!>12)
      throw new ServiceUnavailableException('Required computed factor is unavailable');
    factors = [{name:planet.name, sign:planet.sign, house:planet.house!}];
    interpretation = `The local sidereal chart places ${planet.name} in ${planet.sign}, whole-sign house ${planet.house}. Use this traditional association as a reflection prompt for ${definition.label.toLowerCase()}, not a prediction of an event or another person's thoughts.`;
  }
  const localized = localizedSmartInterpretation(locale,category,factors,detectedYogas);
  interpretation = localized.interpretation;
  const validUntil = new Date(now.getTime()+86400000).toISOString();
  const identity = createHash('sha256').update(JSON.stringify([LOCALIZED_SMART_VERSION,category,locale,factors,now.toISOString().slice(0,10)])).digest('hex');
  return {id:identity,version:LOCALIZED_SMART_VERSION,category,locale,title:localized.title,
    calculationSource:`local-vedic/whole-sign/natal-yoga-v1/${LOCALIZED_SMART_VERSION}`,factors,interpretation,
    linguisticReview:localized.linguisticReview,
    generatedAt:now.toISOString(),validUntil,validityPurpose:'PREVIEW_CACHE_WINDOW_NOT_EVENT_TIMING',provenance:'COMPUTED_FACTORS_WITH_TRADITIONAL_INTERPRETATION',
    scientificStatus:'Interpretation is not scientifically verified',
    entitlement:'UNAPPROVED_PREVIEW_ONLY',deliverable:false,
    deepLink:null, // Never invent an authorized persisted content destination.
  };
}
