import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcRole, RtcTokenBuilder } from 'agora-token';

const DEFAULT_TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour
const MAX_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;

@Injectable()
export class AgoraService {
  constructor(private readonly config: ConfigService) {}

  generateRtcToken(
    channelName: string,
    uid: number,
    role: 'PUBLISHER' | 'SUBSCRIBER' = 'PUBLISHER',
    lifetimeCapSeconds?: number,
  ) {
    const normalizedChannel = channelName?.trim();

    if (!normalizedChannel) {
      throw new InternalServerErrorException('Agora channel name is missing.');
    }

    if (!Number.isInteger(uid) || uid <= 0) {
      throw new InternalServerErrorException('Invalid Agora UID.');
    }

    const appId = this.config.get<string>('AGORA_APP_ID')?.trim();

    const appCertificate = this.config
      .get<string>('AGORA_APP_CERTIFICATE')
      ?.trim();

    if (!appId) {
      throw new InternalServerErrorException('AGORA_APP_ID is missing.');
    }

    if (!appCertificate) {
      throw new InternalServerErrorException(
        'AGORA_APP_CERTIFICATE is missing.',
      );
    }

    const configuredExpiry = this.config.get<string | number>(
      'AGORA_TOKEN_EXPIRY',
    );
    const rawExpiry = configuredExpiry?.toString().trim() ?? '';
    let expirySeconds =
      rawExpiry === '' ? DEFAULT_TOKEN_EXPIRY_SECONDS : Number(rawExpiry);

    if (
      (rawExpiry !== '' && !/^\d+$/.test(rawExpiry)) ||
      !Number.isInteger(expirySeconds) ||
      expirySeconds < 1 ||
      expirySeconds > MAX_TOKEN_EXPIRY_SECONDS
    ) {
      throw new InternalServerErrorException(
        'AGORA_TOKEN_EXPIRY must be an integer from 1 to 86400 seconds.',
      );
    }

    // Live v2 may shorten (never extend) the existing configured lifetime.
    // Existing consultation and legacy Live callers do not supply this cap.
    if (lifetimeCapSeconds !== undefined) {
      if (
        !Number.isInteger(lifetimeCapSeconds) ||
        lifetimeCapSeconds < 1 ||
        lifetimeCapSeconds > MAX_TOKEN_EXPIRY_SECONDS
      ) {
        throw new InternalServerErrorException('Invalid Agora lifetime cap.');
      }
      expirySeconds = Math.min(expirySeconds, lifetimeCapSeconds);
    }

    const currentTimestamp = Math.floor(Date.now() / 1000);

    const privilegeExpireTime = currentTimestamp + expirySeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      normalizedChannel,
      uid,
      role === 'SUBSCRIBER' ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER,
      // AccessToken2 takes durations, not Unix timestamps. Keep absolute time
      // only in the public response below.
      expirySeconds,
      expirySeconds,
    );

    return {
      success: true,

      appId,

      token,

      channelName: normalizedChannel,

      uid,

      role,

      issuedAt: currentTimestamp,

      expiresAt: privilegeExpireTime,

      expiresIn: expirySeconds,
    };
  }

  getRtcConfiguration() {
    const appId = this.config.get<string>('AGORA_APP_ID')?.trim();

    if (!appId) {
      throw new InternalServerErrorException('AGORA_APP_ID is missing.');
    }

    return {
      appId,
    };
  }
}
