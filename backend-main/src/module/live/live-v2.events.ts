import { Injectable, Logger } from '@nestjs/common';

export interface LiveEndedEvent {
  eventId: string;
  sessionId: string;
  status: 'ENDED';
  endedAt: Date;
  reason: 'EXPLICIT_END' | 'HOST_LEASE_EXPIRED';
}
export const LIVE_ENDED = Symbol('committed-live-ended');

@Injectable()
export class LiveV2Events {
  private readonly logger = new Logger(LiveV2Events.name);
  private readonly listeners = new Set<
    (event: LiveEndedEvent) => Promise<void> | void
  >();
  subscribe(listener: (event: LiveEndedEvent) => Promise<void> | void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  async publish(event: LiveEndedEvent) {
    // Best-effort process-local delivery, after DB commit. Status is durable
    // truth. This is not an outbox or a cross-instance Socket.IO adapter.
    await Promise.all(
      [...this.listeners].map(async (listener) => {
        try {
          await listener(event);
        } catch {
          this.logger.warn(
            'Live ended notification delivery failed; recover through status',
          );
        }
      }),
    );
  }
}
