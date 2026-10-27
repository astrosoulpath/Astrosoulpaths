import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/calling/data/agora_audio_service.dart';
import 'package:astro_soul_path/features/calling/data/agora_video_service.dart';
import 'package:astro_soul_path/features/calling/data/call_api.dart';
import 'package:astro_soul_path/features/calling/data/call_models.dart';
import 'package:astro_soul_path/features/calling/data/call_coordinator.dart';
import 'package:astro_soul_path/features/calling/data/video_call_coordinator.dart';

CallRtcCredentials credentials({
  String channel = 'channel',
  int uid = 1,
  String call = 'call',
  String app = 'app',
}) => CallRtcCredentials(
  callId: call,
  appId: app,
  token: 'mock-token',
  channelName: channel,
  uid: uid,
  role: 'PUBLISHER',
  tokenExpiresAt: DateTime.now().add(const Duration(minutes: 1)),
  callExpiresAt: DateTime.now().add(const Duration(minutes: 1)),
  raw: const {},
);

class FakeApi extends CallApi {
  Future<CallRtcCredentials> Function() token = () async => credentials();
  bool endFails = false;
  int requests = 0, ends = 0;
  @override
  Future<CallRtcCredentials> generateRtcToken(String callId) {
    requests++;
    return token();
  }

  @override
  Future<CurrentCallSession?> endCall(String callId, {String? reason}) async {
    ends++;
    if (endFails) throw const CallApiException('fixture');
    return null;
  }
}

class FakeAudio extends AgoraAudioService {
  int leaves = 0, disposals = 0, joins = 0;
  bool initialized = true;
  Future<void> Function()? initializing;
  bool leaveFails = false;
  @override
  bool get isInitialized => initialized;
  @override
  Future<void> initialize({required String appId}) async {
    await initializing?.call();
    initialized = true;
  }

  @override
  bool get isJoined => true;
  @override
  Future<void> join({
    required String token,
    required String channelName,
    required int uid,
  }) async {
    joins++;
    onLocalJoined?.call(uid);
  }

  @override
  Future<void> leave() async {
    leaves++;
    if (leaveFails) throw StateError('fixture');
  }

  @override
  Future<void> dispose() async {
    disposals++;
  }
}

class FakeVideo extends AgoraVideoService {
  int joins = 0, leaves = 0, renewals = 0;
  bool leaveFails = false;
  int disposals = 0;
  @override
  bool get isInitialized => initialized;
  bool initialized = true;
  Future<void> Function()? initializing;
  @override
  Future<void> initialize({required String appId}) async {
    await initializing?.call();
    initialized = true;
  }

  @override
  bool get isJoined => true;
  @override
  Future<void> join({
    required String token,
    required String channelName,
    required int uid,
  }) async {
    joins++;
    onLocalJoined?.call(uid);
  }

  @override
  Future<void> renewToken(String token) async {
    renewals++;
  }

  @override
  Future<void> leave() async {
    leaves++;
    if (leaveFails) throw StateError('fixture');
  }

  @override
  Future<void> dispose() async {
    disposals++;
  }
}

Future<void> flush() async {
  for (var i = 0; i < 12; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  for (final mode in ['audio', 'video']) {
    test(
      '$mode late engine initialization after hang-up is disposed without joining',
      () async {
        final pending = Completer<void>();
        final api = FakeApi();
        final audio = FakeAudio()
          ..initialized = false
          ..initializing = () => pending.future;
        final video = FakeVideo()
          ..initialized = false
          ..initializing = () => pending.future;
        final dynamic call = mode == 'audio'
            ? CallCoordinator(callApi: api, audioService: audio)
            : VideoCallCoordinator(
                callApi: api,
                videoService: video,
                readUserId: () async => 'owner',
              );
        final Future<void> work = call.connect('call');
        await flush();
        await call.end();
        pending.complete();
        await work;
        expect(mode == 'audio' ? audio.joins : video.joins, 0);
        expect(
          mode == 'audio' ? audio.disposals : video.disposals,
          greaterThanOrEqualTo(1),
        );
        await call.dispose();
      },
    );
  }
  test('audio failed native leave falls back to engine disposal', () async {
    final api = FakeApi();
    final rtc = FakeAudio()..leaveFails = true;
    final call = CallCoordinator(callApi: api, audioService: rtc);
    await call.connect('call');
    await call.end();
    expect(rtc.disposals, 1);
    expect(api.ends, 1);
    expect(call.state, CallCoordinatorState.ended);
    await call.dispose();
  });
  for (final action in ['end', 'dispose']) {
    test(
      'video $action fences pending initial token and late native callbacks',
      () async {
        final api = FakeApi();
        final rtc = FakeVideo();
        final pending = Completer<CallRtcCredentials>();
        api.token = () => pending.future;
        final call = VideoCallCoordinator(
          callApi: api,
          videoService: rtc,
          readUserId: () async => 'owner',
        );
        final connection = call.connect('call');
        await flush();
        if (action == 'end') {
          await call.end();
        } else {
          await call.dispose();
        }
        pending.complete(credentials());
        await connection;
        rtc.onLocalJoined?.call(1);
        expect(rtc.joins, 0);
        expect(call.state, isNot(VideoCallCoordinatorState.connected));
        if (action == 'end') await call.dispose();
      },
    );
  }
  test(
    'audio hang-up releases media and stays ended when backend fails; explicit retry is safe',
    () async {
      final api = FakeApi()..endFails = true;
      final rtc = FakeAudio();
      final call = CallCoordinator(callApi: api, audioService: rtc);
      await call.connect('call');
      await call.end();
      expect(rtc.leaves, 1);
      expect(call.state, CallCoordinatorState.ended);
      expect(call.hasPendingBackendEnd, true);
      expect(api.ends, 1);
      api.endFails = false;
      await call.end();
      expect(call.hasPendingBackendEnd, false);
      expect(rtc.leaves, 1);
      expect(api.ends, 2);
      await call.dispose();
    },
  );
  test('simultaneous audio hang-ups do not duplicate backend end', () async {
    final api = FakeApi();
    final rtc = FakeAudio();
    final call = CallCoordinator(callApi: api, audioService: rtc);
    await call.connect('call');
    await Future.wait([call.end(), call.end()]);
    expect(api.ends, 1);
    expect(rtc.leaves, 1);
    await call.dispose();
  });
  test('video renewal is single-flight and preserves UID/channel', () async {
    final api = FakeApi();
    final rtc = FakeVideo();
    final call = VideoCallCoordinator(
      callApi: api,
      videoService: rtc,
      readUserId: () async => 'owner',
    );
    await call.connect('call');
    final pending = Completer<CallRtcCredentials>();
    api.token = () => pending.future;
    rtc.onTokenWillExpire?.call();
    rtc.onTokenWillExpire?.call();
    await flush();
    expect(api.requests, 2);
    pending.complete(credentials());
    await flush();
    expect(rtc.renewals, 1);
    await call.dispose();
  });
  for (final changed in [
    credentials(channel: 'foreign'),
    credentials(uid: 2),
    credentials(call: 'foreign'),
    credentials(app: 'foreign'),
  ]) {
    test(
      'video rejects changed renewal binding ${changed.channelName}/${changed.uid}/${changed.callId}/${changed.appId}',
      () async {
        final api = FakeApi();
        final rtc = FakeVideo();
        final call = VideoCallCoordinator(
          callApi: api,
          videoService: rtc,
          readUserId: () async => 'owner',
        );
        await call.connect('call');
        api.token = () async => changed;
        rtc.onTokenWillExpire?.call();
        await flush();
        expect(rtc.renewals, 0);
        expect(call.errorMessage, isNotNull);
        await call.dispose();
      },
    );
  }
  for (final action in ['end', 'dispose', 'account switch']) {
    test('video $action fences a delayed renewal', () async {
      final api = FakeApi();
      final rtc = FakeVideo();
      var owner = 'owner';
      final call = VideoCallCoordinator(
        callApi: api,
        videoService: rtc,
        readUserId: () async => owner,
      );
      await call.connect('call');
      final pending = Completer<CallRtcCredentials>();
      api.token = () => pending.future;
      rtc.onTokenWillExpire?.call();
      await flush();
      if (action == 'end') {
        await call.end();
      }
      if (action == 'dispose') {
        await call.dispose();
      }
      if (action == 'account switch') {
        owner = 'foreign';
      }
      pending.complete(credentials());
      await flush();
      expect(rtc.renewals, 0);
      if (action != 'dispose') await call.dispose();
    });
  }
  test('duplicate video connects do not initialize/join twice', () async {
    final api = FakeApi();
    final rtc = FakeVideo();
    final call = VideoCallCoordinator(
      callApi: api,
      videoService: rtc,
      readUserId: () async => 'owner',
    );
    await Future.wait([call.connect('call'), call.connect('call')]);
    await call.connect('call');
    expect(api.requests, 1);
    expect(rtc.joins, 1);
    await call.dispose();
  });
  test(
    'video leave failure falls back to native disposal and backend end',
    () async {
      final api = FakeApi();
      final rtc = FakeVideo()..leaveFails = true;
      final call = VideoCallCoordinator(
        callApi: api,
        videoService: rtc,
        readUserId: () async => 'owner',
      );
      await call.connect('call');
      await call.end();
      await call.end();
      expect(rtc.disposals, 1);
      expect(api.ends, 1);
      expect(call.state, VideoCallCoordinatorState.ended);
      await call.dispose();
    },
  );
}
