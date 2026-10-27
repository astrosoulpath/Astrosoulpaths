jest.mock('../live/live-schema-compatibility', () => ({
  ...jest.requireActual('../live/live-schema-compatibility'),
  hasLiveV2Schema: jest.fn().mockResolvedValue(true),
}));
import { ConfigService } from '@nestjs/config';
import { AgoraService } from './agora.service';
import { CallService } from './call.service';
import { LiveService } from '../live/live.service';

// Decode actual SDK output; these are deliberately synthetic test credentials.
const {
  AccessToken2,
  kRtcServiceType,
} = require('agora-token/src/AccessToken2');
const appId = 'a'.repeat(32);
const certificate = 'b'.repeat(32);
function service(expiry?: unknown) {
  return new AgoraService(
    new ConfigService({
      AGORA_APP_ID: appId,
      AGORA_APP_CERTIFICATE: certificate,
      AGORA_TOKEN_EXPIRY: expiry,
    }),
  );
}
function decode(token: string) {
  const decoded = new AccessToken2('', '', 0, 0);
  decoded.from_string(token);
  const rtc = decoded.services[kRtcServiceType];
  rtc.__channel_name = rtc.__channel_name.toString();
  rtc.__uid = rtc.__uid.toString();
  return { decoded, rtc };
}

describe('Agora AccessToken2 lifetime and caller compatibility', () => {
  it('Live v2 lifetime cap shortens actual privileges without extending configured expiry', () => {
    const short = service('600').generateRtcToken(
      'v2-channel',
      17,
      'SUBSCRIBER',
      120,
    );
    expect(decode(short.token).decoded.expire).toBe(120);
    expect(decode(short.token).rtc.__privileges).toEqual({ 1: 120 });
    const configured = service('60').generateRtcToken(
      'v2-channel',
      17,
      'PUBLISHER',
      120,
    );
    expect(decode(configured.token).decoded.expire).toBe(60);
    expect(decode(configured.token).rtc.__privileges).toEqual({
      1: 60,
      2: 60,
      3: 60,
      4: 60,
    });
  });
  it.each([0, -1, 1.5, NaN, 86401])(
    'invalid Live cap fails closed (%p)',
    (cap) => {
      expect(() =>
        service('600').generateRtcToken('v2', 1, 'PUBLISHER', cap),
      ).toThrow('lifetime cap');
    },
  );
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(['PUBLISHER', 'SUBSCRIBER'] as const)(
    '%s encodes duration, original channel/UID and only intended privileges',
    (role) => {
      // The SDK uses new Date(), while AgoraService uses Date.now().
      jest.useFakeTimers().setSystemTime(1_800_000_000_000);
      const result = service('600').generateRtcToken(
        'original-channel',
        123,
        role,
      );
      const { decoded, rtc } = decode(result.token);
      expect(result.token.startsWith('007')).toBe(true);
      expect(decoded.issueTs).toBe(result.issuedAt);
      expect(decoded.expire).toBe(600);
      expect(decoded.issueTs + decoded.expire).toBe(result.expiresAt);
      expect(rtc.__channel_name).toBe('original-channel');
      expect(rtc.__uid).toBe('123');
      expect(rtc.__privileges).toEqual(
        role === 'PUBLISHER' ? { 1: 600, 2: 600, 3: 600, 4: 600 } : { 1: 600 },
      );
      expect(result).toEqual({
        success: true,
        appId,
        token: expect.any(String),
        channelName: 'original-channel',
        uid: 123,
        role,
        issuedAt: 1_800_000_000,
        expiresAt: 1_800_000_600,
        expiresIn: 600,
      });
    },
  );

  it.each([undefined, '', '  '])(
    'unset/blank configuration retains one-hour default (%p)',
    (expiry) => {
      const result = service(expiry).generateRtcToken('channel', 1);
      expect(result.expiresIn).toBe(3600);
      expect(decode(result.token).decoded.expire).toBe(3600);
      expect(result.role).toBe('PUBLISHER');
    },
  );
  it.each([1, '86400'])(
    'accepts bounded integer configuration (%p)',
    (expiry) => {
      const result = service(expiry).generateRtcToken('channel', 1);
      expect(decode(result.token).decoded.expire).toBe(Number(expiry));
    },
  );
  it.each([
    'bad',
    0,
    -1,
    1.5,
    'Infinity',
    'NaN',
    86401,
    true,
    '0x10',
    '1800000000',
  ])(
    'rejects invalid expiry without silently issuing a token (%p)',
    (expiry) => {
      expect(() => service(expiry).generateRtcToken('channel', 1)).toThrow(
        'AGORA_TOKEN_EXPIRY',
      );
    },
  );

  it.each(['startLive', 'joinLive'])(
    'Live %s uses real bounded SDK tokens',
    async (method) => {
      const host = {
        id: 'canonical',
        isActive: true,
        isBlocked: false,
        isAstrologer: true,
        astrologer: { id: 'astro', isApproved: true, isVerified: true },
      };
      const live = {
        id: 'live',
        connectionProtocol: 1,
        channelName: 'live-channel',
        astrologerId: 'astro',
        astrologer: { ...host.astrologer, user: { name: 'Host' } },
      };
      const db: any = {
        userAuthIdentity: {
          findUnique: jest.fn().mockResolvedValue({ userId: host.id }),
        },
        user: { findUnique: jest.fn().mockResolvedValue(host) },
        liveSession: { findFirst: jest.fn().mockResolvedValue(live) },
        liveViewer: {
          updateMany: jest.fn(),
          create: jest.fn(),
          count: jest.fn().mockResolvedValue(1),
        },
        $queryRaw: jest.fn().mockResolvedValue([{ id: 'astro' }]),
      };
      db.$transaction = jest.fn((operation) => operation(db));
      const liveService = new LiveService(db, service('600'));
      const result =
        method === 'startLive'
          ? await liveService.startLive('subject')
          : await liveService.joinLive('subject', 'live');
      const { decoded, rtc } = decode(result.data.rtc.token);
      expect(decoded.expire).toBe(600);
      expect(rtc.__uid).toBe(String(result.data.rtc.uid));
      expect(rtc.__channel_name).toBe(live.channelName);
      expect(Object.keys(rtc.__privileges)).toEqual(
        method === 'startLive' ? ['1', '2', '3', '4'] : ['1'],
      );
    },
  );

  it.each(['audio', 'video'])(
    '%s consultation token preserves participant and API contract',
    async (mode) => {
      const expiry = new Date(Date.now() + 300_000);
      const call = {
        id: 'call',
        userId: 'canonical',
        astrologerId: 'other',
        channelName: 'consultation-channel',
        mode,
        status: 'ACTIVE',
        endedAt: null,
        expiresAt: expiry,
      };
      const db: any = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'canonical',
            isActive: true,
            isBlocked: false,
          }),
        },
        callSession: {
          findUnique: jest.fn().mockResolvedValue(call),
          findFirst: jest.fn().mockResolvedValue(call),
        },
        platformSettings: {
          upsert: jest.fn().mockResolvedValue({ videoCallEnabled: true }),
        },
      };
      const calls = new CallService(db, service('600'));
      const result = await calls.generateAgoraToken('subject', 'call');
      const { decoded, rtc } = decode(result.data.token);
      expect(decoded.expire).toBeLessThanOrEqual(300);
      expect(decoded.expire).toBeGreaterThanOrEqual(299);
      expect(rtc.__channel_name).toBe(call.channelName);
      expect(rtc.__uid).toBe(String(result.data.uid));
      expect(rtc.__privileges).toEqual({ 1: decoded.expire, 2: decoded.expire, 3: decoded.expire, 4: decoded.expire });
      expect(result.data).toEqual(
        expect.objectContaining({
          callId: 'call',
          role: 'PUBLISHER',
          expiresAt: expiry,
          expiresIn: decoded.expire,
          channelName: call.channelName,
        }),
      );
      const second = await calls.generateAgoraToken('subject', 'call');
      expect(second.data.uid).toBe(result.data.uid);
    },
  );
});
