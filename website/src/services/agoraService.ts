"use client";

import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL;

export type AgoraTokenResponse = {
  success: boolean;
  data: {
    appId: string;
    token: string;
    channelName: string;
    uid: number;
    expiresIn: number;
    callId: string;
  };
};

class AgoraService {
  private client: IAgoraRTCClient;

  private localAudioTrack: IMicrophoneAudioTrack | null =
    null;

  constructor() {
    this.client = AgoraRTC.createClient({
      mode: "rtc",
      codec: "vp8",
    });
  }

  getClient() {
    return this.client;
  }

  async join(
    appId: string,
    channelName: string,
    token: string,
    uid: number,
  ) {
    await this.client.join(
      appId,
      channelName,
      token,
      uid,
    );

    this.localAudioTrack =
      await AgoraRTC.createMicrophoneAudioTrack();

    await this.client.publish([
      this.localAudioTrack,
    ]);
  }

  async leave() {
    if (this.localAudioTrack) {
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }

    await this.client.leave();
  }

  async mute(muted: boolean) {
    if (!this.localAudioTrack) {
      return;
    }

    await this.localAudioTrack.setEnabled(
      !muted,
    );
  }

  async getToken(
    callId: string,
  ): Promise<AgoraTokenResponse> {
    const accessToken =
      localStorage.getItem(
        "asp_access_token",
      );

    if (!accessToken) {
      throw new Error(
        "LOGIN_REQUIRED",
      );
    }

    if (!API_BASE_URL) {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL is missing.",
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/call/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          callId,
        }),
      },
    );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ??
          "Unable to generate Agora token.",
      );
    }

    return data;
  }
}

const agoraService =
  new AgoraService();

export default agoraService;