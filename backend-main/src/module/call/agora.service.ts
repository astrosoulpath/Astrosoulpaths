import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RtcRole,
  RtcTokenBuilder,
} from 'agora-token';

const DEFAULT_TOKEN_EXPIRY_SECONDS =
  60 * 60; // 1 hour

@Injectable()
export class AgoraService {
  constructor(
    private readonly config: ConfigService,
  ) {}

  generateRtcToken(
    channelName: string,
    uid: number,
  ) {
    const normalizedChannel =
      channelName?.trim();

    if (!normalizedChannel) {
      throw new InternalServerErrorException(
        'Agora channel name is missing.',
      );
    }

    if (
      !Number.isInteger(uid) ||
      uid <= 0
    ) {
      throw new InternalServerErrorException(
        'Invalid Agora UID.',
      );
    }

    const appId = this.config
      .get<string>('AGORA_APP_ID')
      ?.trim();

    const appCertificate =
      this.config
        .get<string>(
          'AGORA_APP_CERTIFICATE',
        )
        ?.trim();

    if (!appId) {
      throw new InternalServerErrorException(
        'AGORA_APP_ID is missing.',
      );
    }

    if (!appCertificate) {
      throw new InternalServerErrorException(
        'AGORA_APP_CERTIFICATE is missing.',
      );
    }

    const expirySeconds =
      Number(
        this.config.get(
          'AGORA_TOKEN_EXPIRY',
        ),
      ) ||
      DEFAULT_TOKEN_EXPIRY_SECONDS;

    const currentTimestamp =
      Math.floor(Date.now() / 1000);

    const privilegeExpireTime =
      currentTimestamp +
      expirySeconds;

    const token =
      RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        normalizedChannel,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpireTime,
        privilegeExpireTime,
      );

    return {
      success: true,

      appId,

      token,

      channelName:
        normalizedChannel,

      uid,

      role: 'PUBLISHER',

      issuedAt:
        currentTimestamp,

      expiresAt:
        privilegeExpireTime,

      expiresIn:
        expirySeconds,
    };
  }

  getRtcConfiguration() {
    const appId = this.config
      .get<string>('AGORA_APP_ID')
      ?.trim();

    if (!appId) {
      throw new InternalServerErrorException(
        'AGORA_APP_ID is missing.',
      );
    }

    return {
      appId,
    };
  }
}