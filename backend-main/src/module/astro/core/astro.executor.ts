import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { AstroParams } from '../../../common/types/astro-params.type';

type ExecutorOptions<T> = {
  params: AstroParams;

  // 🔥 API function (Dasha/Dosha/Panchang etc.)
  fetcher: (params: AstroParams) => Promise<any>;

  // 🔥 Optional transformer (clean output)
  transformer?: (data: any) => T;

  // ⚡ Optional configs
  retries?: number;
  timeoutMs?: number;
};

@Injectable()
export class AstroExecutor {
  async execute<T>({
    params,
    fetcher,
    transformer,
    retries = 2,
    timeoutMs = 5000,
  }: ExecutorOptions<T>): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 🔥 Execute with timeout
        const raw = await this.withTimeout(fetcher(params), timeoutMs);

        // 🔥 Transform response
        const result = transformer ? transformer(raw) : raw;

        return result;
      } catch (error: unknown) {
        lastError = error;

        const message =
          error instanceof Error ? error.message : 'Unknown error';

        console.error(
          `❌ AstroExecutor attempt ${attempt + 1} failed: ${message}`,
        );

        // 🔁 Retry if attempts left
        if (attempt < retries) continue;

        // ❌ Final failure
        throw new HttpException(
          {
            success: false,
            message: 'Astro computation failed',
            error: message,
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    }

    // fallback (should not reach here)
    throw new HttpException(
      'Unexpected execution failure',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  // 🔥 Timeout wrapper
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, ms);

      promise
        .then((res) => {
          clearTimeout(timer);
          resolve(res);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
