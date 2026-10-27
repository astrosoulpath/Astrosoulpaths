import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { LiveV2Service } from './live-v2.service';

@Injectable()
export class LiveV2Worker {
  private readonly logger = new Logger(LiveV2Worker.name);
  private running = false;
  constructor(
    private readonly live: LiveV2Service,
    private readonly config: ConfigService,
  ) {}
  @Interval(5000)
  async tick() {
    // Fail closed until migration/target identity and activation are approved.
    if (
      this.config.get('LIVE_V2_ENABLED') !== 'true' ||
      this.config.get('LIVE_V2_SOCKET_SINGLE_INSTANCE') !== 'true' ||
      this.config.get('LIVE_V2_MAINTENANCE_ENABLED') !== 'true' ||
      this.running
    )
      return;
    this.running = true;
    try {
      const result = await this.live.sweepLeases();
      if (result.failures)
        this.logger.warn(
          'Live lease cleanup incomplete; retry on next scheduled sweep',
        );
    } catch {
      this.logger.warn(
        'Live lease sweep failed; no unverified timeout events emitted',
      );
    } finally {
      this.running = false;
    }
  }
}
