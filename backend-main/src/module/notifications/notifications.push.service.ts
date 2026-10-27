import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type PushPayload = {
  expiresAt?: Date;
  title: string;
  body: string;
  data?: Record<string, string>;
};

@Injectable()
export class NotificationsPushService {
  private readonly logger = new Logger(NotificationsPushService.name);
  private readonly firebaseApp: App | null;

  constructor(private readonly prisma: PrismaService) {
    this.firebaseApp = this.initializeFirebase();
  }

  isConfigured(): boolean {
    return this.firebaseApp !== null;
  }

  private initializeFirebase(): App | null {
    const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
    const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY?.trim();

    if (!projectId || !clientEmail || !privateKeyRaw) {
      this.logger.warn(
        'Firebase Admin credentials are not configured. Push sending is disabled.',
      );
      return null;
    }

    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    try {
      // Never reuse an unrelated Admin app merely because it initialized first.
      const apps = getApps();
      const matching = apps.find((app) => app.options.projectId === projectId);
      if (matching) return matching;
      if (apps.length > 0) {
        this.logger.warn(
          'Firebase project mismatch. Push sending is disabled.',
        );
        return null;
      }

      return initializeApp({
        projectId,
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      this.logger.error('Firebase Admin initialization failed');
      return null;
    }
  }

  async sendToUser(
    userId: string,
    payload: PushPayload,
    deviceId?: string,
    mobileOnly = false,
  ) {
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId,
        isActive: true,
        user: { is: { isActive: true, isBlocked: false } },
        ...(deviceId ? { id: deviceId } : {}),
        ...(mobileOnly
          ? { platform: { in: ['ANDROID' as const, 'IOS' as const] } }
          : {}),
      },
      select: {
        id: true,
        fcmToken: true,
      },
    });

    if (devices.length === 0) {
      return {
        success: true,
        configured: this.firebaseApp != null,
        sent: 0,
        failed: 0,
        failureCodes: [] as string[],
      };
    }

    if (!this.firebaseApp) {
      return {
        success: true,
        configured: false,
        sent: 0,
        failed: 0,
        failureCodes: [] as string[],
      };
    }

    let sent = 0;
    let failed = 0;
    const failureCodes: string[] = [];
    // Stay within the outbox lease. A timed-out provider request cannot be
    // cancelled reliably and must remain acceptance-UNKNOWN, never auto-retried.
    const deadline = Date.now() + 30_000;

    for (const device of devices) {
      if (Date.now() >= deadline) {
        failed += devices.length - sent - failed;
        failureCodes.push('FCM_DEADLINE_UNKNOWN');
        break;
      }
      try {
        // Recheck ownership immediately before sending, not only when fetching
        // the batch. Reassignment/logout during earlier sends invalidates it.
        const current = await this.prisma.pushDevice.findFirst({
          where: {
            id: device.id,
            userId,
            isActive: true,
            fcmToken: device.fcmToken,
            user: { is: { isActive: true, isBlocked: false } },
          },
        });
        if (!current) {
          failed++;
          failureCodes.push('DEVICE_OWNERSHIP_CHANGED');
          continue;
        }
        if (payload.expiresAt && payload.expiresAt.getTime() <= Date.now()) {
          failed++;
          failureCodes.push('ENTITLEMENT_EXPIRED');
          continue;
        }
        // A slow ownership lookup must not start a provider request after the
        // batch budget has already elapsed.
        if (Date.now() >= deadline) {
          failed += devices.length - sent - failed;
          failureCodes.push('FCM_DEADLINE_UNKNOWN');
          break;
        }
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            getMessaging(this.firebaseApp).send({
              token: device.fcmToken,
              notification: {
                title: payload.title,
                body: payload.body,
              },
              // Caller data may never override the canonical recipient identity.
              data: { ...(payload.data ?? {}), ownerId: userId },
              android: {
                priority: 'high',
                ...(payload.expiresAt
                  ? {
                      ttl: Math.max(
                        0,
                        payload.expiresAt.getTime() - Date.now(),
                      ),
                    }
                  : {}),
              },
              apns: {
                ...(payload.expiresAt
                  ? {
                      headers: {
                        'apns-expiration': String(
                          Math.floor(payload.expiresAt.getTime() / 1000),
                        ),
                      },
                    }
                  : {}),
                payload: {
                  aps: {
                    sound: 'default',
                  },
                },
              },
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(
                () => reject({ code: 'FCM_TIMEOUT_UNKNOWN' }),
                Math.min(10_000, Math.max(1, deadline - Date.now())),
              );
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }

        sent += 1;
      } catch (error) {
        failed += 1;

        const code =
          error && typeof error === 'object' && 'code' in error
            ? String(error.code)
            : '';
        failureCodes.push(
          [
            'messaging/quota-exceeded',
            'messaging/server-unavailable',
            'messaging/registration-token-not-registered',
            'messaging/invalid-registration-token',
            'FCM_TIMEOUT_UNKNOWN',
          ].includes(code)
            ? code
            : 'FCM_UNKNOWN',
        );
        this.logger.warn('Push send failed');

        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await this.prisma.pushDevice.updateMany({
            where: {
              id: device.id,
              userId,
              fcmToken: device.fcmToken,
              isActive: true,
            },
            data: {
              isActive: false,
            },
          });
        }
      }
    }

    return {
      success: true,
      configured: true,
      sent,
      failed,
      failureCodes,
    };
  }
}
