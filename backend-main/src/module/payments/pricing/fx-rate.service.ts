import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

type LatestFxResponse = {
  timestamp?: number;
  base?: string;
  rates?: Record<string, number>;
};

type CachedRates = {
  expiresAt: number;
  timestamp: number;
  rates: Record<string, number>;
};

@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);

  private readonly cacheTtlMs = 30 * 60 * 1000;

  private cached: CachedRates | null = null;

  async getRate(
    baseCurrency: string,
    targetCurrency: string,
  ): Promise<{
    rate: number;
    source: 'openexchangerates';
    providerTimestamp: Date;
  }> {
    const base = baseCurrency.trim().toUpperCase();
    const target = targetCurrency.trim().toUpperCase();

    if (!base || !target) {
      throw new BadGatewayException('Base and target currency are required');
    }

    if (base === target) {
      return {
        rate: 1,
        source: 'openexchangerates',
        providerTimestamp: new Date(),
      };
    }

    const data = await this.getRates();

    const baseUsdRate = base === 'USD' ? 1 : data.rates[base];

    const targetUsdRate = target === 'USD' ? 1 : data.rates[target];

    if (
      typeof baseUsdRate !== 'number' ||
      !Number.isFinite(baseUsdRate) ||
      baseUsdRate <= 0
    ) {
      this.logger.error(`fx.base_currency_unavailable currency=${base}`);

      throw new BadGatewayException(
        `Live exchange rate is unavailable for ${base}`,
      );
    }

    if (
      typeof targetUsdRate !== 'number' ||
      !Number.isFinite(targetUsdRate) ||
      targetUsdRate <= 0
    ) {
      this.logger.error(`fx.target_currency_unavailable currency=${target}`);

      throw new BadGatewayException(
        `Live exchange rate is unavailable for ${target}`,
      );
    }

    /*
     * Open Exchange Rates returns USD-relative rates:
     *
     * 1 USD = X BASE
     * 1 USD = Y TARGET
     *
     * Therefore:
     *
     * 1 BASE = Y / X TARGET
     */
    const crossRate = targetUsdRate / baseUsdRate;

    if (!Number.isFinite(crossRate) || crossRate <= 0) {
      throw new BadGatewayException('Unable to calculate exchange rate');
    }

    return {
      rate: crossRate,
      source: 'openexchangerates',
      providerTimestamp: new Date(data.timestamp * 1000),
    };
  }

  async getUsdRate(targetCurrency: string): Promise<{
    rate: number;
    source: 'openexchangerates';
    providerTimestamp: Date;
  }> {
    return this.getRate('USD', targetCurrency);
  }

  private async getRates(): Promise<{
    timestamp: number;
    rates: Record<string, number>;
  }> {
    const now = Date.now();

    if (this.cached && this.cached.expiresAt > now) {
      return {
        timestamp: this.cached.timestamp,
        rates: this.cached.rates,
      };
    }

    const appId = process.env.OPEN_EXCHANGE_RATES_APP_ID?.trim();

    if (!appId) {
      this.logger.error('fx.openexchangerates_app_id_missing');

      throw new InternalServerErrorException(
        'FX provider configuration is missing',
      );
    }

    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        'https://openexchangerates.org/api/latest.json',
        {
          headers: {
            Authorization: `Token ${appId}`,
            Accept: 'application/json',
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        this.logger.error(`fx.provider_http_error status=${response.status}`);

        throw new BadGatewayException('Unable to retrieve live exchange rates');
      }

      const body = (await response.json()) as LatestFxResponse;

      const timestamp = body.timestamp;
      const rates = body.rates;

      if (
        typeof timestamp !== 'number' ||
        !rates ||
        typeof rates !== 'object'
      ) {
        this.logger.error('fx.provider_invalid_payload');

        throw new BadGatewayException(
          'FX provider returned an invalid response',
        );
      }

      this.cached = {
        expiresAt: now + this.cacheTtlMs,
        timestamp,
        rates,
      };

      return {
        timestamp,
        rates,
      };
    } catch (error) {
      if (
        error instanceof BadGatewayException ||
        error instanceof InternalServerErrorException
      ) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`fx.provider_request_failed reason=${message}`);

      throw new BadGatewayException('Unable to retrieve live exchange rates');
    } finally {
      clearTimeout(timeout);
    }
  }
}
