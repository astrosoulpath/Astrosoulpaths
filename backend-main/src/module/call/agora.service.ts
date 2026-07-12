import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  RtcRole,
  RtcTokenBuilder,
} from 'agora-token';

@Injectable()
export class AgoraService {
  constructor(
    private readonly config: ConfigService,
  ) {}

  generateRtcToken(
    channelName: string,
    uid: number,
  ) {
    const appId =
      this.config.get<string>(
        'AGORA_APP_ID',
      );

    const appCertificate =
      this.config.get<string>(
        'AGORA_APP_CERTIFICATE',
      );

    if (
      !appId ||
      !appCertificate
    ) {
      throw new InternalServerErrorException(
        'Agora credentials are missing.',
      );
    }

    const role = RtcRole.PUBLISHER;

    const expireSeconds = 60 * 60;

    const currentTimestamp =
      Math.floor(Date.now() / 1000);

    const privilegeExpireTime =
      currentTimestamp +
      expireSeconds;

    const token =
  RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    role,
    privilegeExpireTime,
    privilegeExpireTime,
  );

    return {
      appId,
      token,
      channelName,
      uid,
      expiresIn: expireSeconds,
    };
  }
}