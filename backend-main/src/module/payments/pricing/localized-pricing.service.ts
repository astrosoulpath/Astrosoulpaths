import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  CountryCurrencyResolver,
  SupportedPricingCurrency,
} from './country-currency.resolver';

import { FxRateService } from './fx-rate.service';

export type LocalizedPriceQuote = {
  baseAmount: string;
  baseCurrency: string;

  amount: string;
  currency: SupportedPricingCurrency;

  countryCode: string | null;

  fxRate: string;

  fxSource: 'openexchangerates';

  quotedAt: string;
};

@Injectable()
export class LocalizedPricingService {
  constructor(private readonly fxRateService: FxRateService) {}

  async quotePrice(input: {
    baseAmount: Prisma.Decimal | number | string;
    baseCurrency: string;
    countryCode?: string | null;
  }): Promise<LocalizedPriceQuote> {
    const baseAmount = new Prisma.Decimal(input.baseAmount);

    if (!baseAmount.isFinite() || baseAmount.lte(0)) {
      throw new BadRequestException('Base amount must be greater than zero');
    }

    const baseCurrency = input.baseCurrency?.trim().toUpperCase();

    if (!baseCurrency) {
      throw new BadRequestException('Base currency is required');
    }

    const countryCode = input.countryCode?.trim().toUpperCase() || null;

    const targetCurrency = CountryCurrencyResolver.resolve(countryCode);

    const fx = await this.fxRateService.getRate(baseCurrency, targetCurrency);

    const converted = baseAmount.mul(fx.rate);

    const amount = this.roundForCurrency(converted, targetCurrency);

    return {
      baseAmount: baseAmount.toFixed(this.decimalPlacesForBase(baseCurrency)),

      baseCurrency,

      amount: amount.toFixed(this.decimalPlaces(targetCurrency)),

      currency: targetCurrency,

      countryCode,

      fxRate: new Prisma.Decimal(fx.rate).toFixed(8),

      fxSource: fx.source,

      quotedAt: fx.providerTimestamp.toISOString(),
    };
  }

  /*
   * Backward-compatible wrapper.
   * Existing callers can continue using this
   * while subscription order integration moves
   * to quotePrice().
   */
  async quoteUsdPrice(input: {
    usdAmount: Prisma.Decimal | number | string;
    countryCode?: string | null;
  }): Promise<LocalizedPriceQuote> {
    return this.quotePrice({
      baseAmount: input.usdAmount,
      baseCurrency: 'USD',
      countryCode: input.countryCode,
    });
  }

  private roundForCurrency(
    amount: Prisma.Decimal,
    currency: SupportedPricingCurrency,
  ): Prisma.Decimal {
    return amount.toDecimalPlaces(
      this.decimalPlaces(currency),
      Prisma.Decimal.ROUND_HALF_UP,
    );
  }

  private decimalPlaces(currency: SupportedPricingCurrency): number {
    if (currency === 'JPY') {
      return 0;
    }

    if (currency === 'KWD' || currency === 'BHD') {
      return 3;
    }

    return 2;
  }

  private decimalPlacesForBase(currency: string): number {
    if (currency === 'JPY') {
      return 0;
    }

    if (currency === 'KWD' || currency === 'BHD') {
      return 3;
    }

    return 2;
  }
}
