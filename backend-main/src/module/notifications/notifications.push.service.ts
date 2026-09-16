import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type PushPayload = {
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
      if (getApps().length > 0) {
        return getApps()[0];
      }

      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      this.logger.error(
        `Firebase Admin initialization failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async sendToUser(userId: string, payload: PushPayload) {
    const devices = await this.prisma.pushDevice.findMany({
      where: {
        userId,
        isActive: true,
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
      };
    }

    if (!this.firebaseApp) {
      return {
        success: true,
        configured: false,
        sent: 0,
        failed: 0,
      };
    }

    let sent = 0;
    let failed = 0;

    for (const device of devices) {
      try {
        await getMessaging(this.firebaseApp).send({
          token: device.fcmToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data: payload.data ?? {},
          android: {
            priority: 'high',
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
              },
            },
          },
        });

        sent += 1;
      } catch (error) {
        failed += 1;

        const message = error instanceof Error ? error.message : String(error);

        this.logger.warn(
          `Push send failed for device ${device.id}: ${message}`,
        );

        if (
          message.includes('registration-token-not-registered') ||
          message.includes('invalid-registration-token')
        ) {
          await this.prisma.pushDevice.update({
            where: {
              id: device.id,
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
    };
  }
}
