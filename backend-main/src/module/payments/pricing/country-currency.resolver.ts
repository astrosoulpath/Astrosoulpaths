export type SupportedPricingCurrency =
  | 'USD'
  | 'INR'
  | 'GBP'
  | 'EUR'
  | 'AED'
  | 'CAD'
  | 'AUD'
  | 'SGD'
  | 'NZD'
  | 'JPY'
  | 'CHF'
  | 'HKD'
  | 'MYR'
  | 'SAR'
  | 'QAR'
  | 'KWD'
  | 'BHD'
  | 'OMR'
  | 'ZAR';

const COUNTRY_TO_CURRENCY: Readonly<Record<string, SupportedPricingCurrency>> =
  Object.freeze({
    US: 'USD',

    IN: 'INR',

    GB: 'GBP',

    IE: 'EUR',
    FR: 'EUR',
    DE: 'EUR',
    IT: 'EUR',
    ES: 'EUR',
    PT: 'EUR',
    NL: 'EUR',
    BE: 'EUR',
    AT: 'EUR',
    FI: 'EUR',
    GR: 'EUR',
    LU: 'EUR',
    CY: 'EUR',
    EE: 'EUR',
    LV: 'EUR',
    LT: 'EUR',
    MT: 'EUR',
    SK: 'EUR',
    SI: 'EUR',
    HR: 'EUR',

    AE: 'AED',

    CA: 'CAD',

    AU: 'AUD',

    SG: 'SGD',

    NZ: 'NZD',

    JP: 'JPY',

    CH: 'CHF',

    HK: 'HKD',

    MY: 'MYR',

    SA: 'SAR',

    QA: 'QAR',

    KW: 'KWD',

    BH: 'BHD',

    OM: 'OMR',

    ZA: 'ZAR',
  });

export class CountryCurrencyResolver {
  static resolve(countryCode?: string | null): SupportedPricingCurrency {
    const normalized = countryCode?.trim().toUpperCase();

    if (!normalized) {
      return 'USD';
    }

    return COUNTRY_TO_CURRENCY[normalized] ?? 'USD';
  }

  static isKnownCountry(countryCode?: string | null): boolean {
    const normalized = countryCode?.trim().toUpperCase();

    if (!normalized) {
      return false;
    }

    return normalized in COUNTRY_TO_CURRENCY;
  }
}
