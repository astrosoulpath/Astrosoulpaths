import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:astro_soul_path/features/live/data/live_rtc_service.dart';
import 'package:astro_soul_path/features/live/data/live_models.dart';

class Engine extends Fake implements RtcEngine {
  final calls = <Symbol>[];
  RtcEngineEventHandler? handler;
  ChannelMediaOptions? options;
  bool failJoin = false;
  @override
  dynamic noSuchMethod(Invocation invocation) {
    calls.add(invocation.memberName);
    if (invocation.memberName == #registerEventHandler) {
      handler = invocation.positionalArguments.first as RtcEngineEventHandler;
      return null;
    }
    if (invocation.memberName == #joinChannel) {
      options = invocation.namedArguments[#options] as ChannelMediaOptions;
      if (failJoin) return Future<void>.error(StateError('join rejected'));
    }
    return Future<void>.value();
  }
}

LiveRtcCredentials proof(String role) => LiveRtcCredentials(
  appId: 'test-app',
  token: 'mock-proof',
  channelName: 'exact-session-channel',
  uid: 42,
  role: role,
  expiresAt: 9999999999,
);

void main() {
  test(
    'transport connected does not report LIVE before channel admission',
    () async {
      final engine = Engine();
      final rtc = LiveRtcService(
        engineFactory: () => engine,
        permissionChecker: (_) async {},
      );
      await rtc.connect(
        credentials: proof('PUBLISHER'),
        role: LiveRtcRole.broadcaster,
      );
      const connection = RtcConnection(localUid: 42);
      engine.handler!.onConnectionStateChanged!(
        connection,
        ConnectionStateType.connectionStateConnected,
        ConnectionChangedReasonType.connectionChangedConnecting,
      );
      expect(rtc.isConnected, false);
      engine.handler!.onJoinChannelSuccess!(connection, 0);
      expect(rtc.isConnected, true);
      engine.handler!.onConnectionLost!(connection);
      engine.handler!.onConnectionStateChanged!(
        connection,
        ConnectionStateType.connectionStateConnected,
        ConnectionChangedReasonType.connectionChangedConnecting,
      );
      expect(rtc.isConnected, false);
      engine.handler!.onRejoinChannelSuccess!(connection, 0);
      expect(rtc.isConnected, true);
      await rtc.dispose();
    },
  );
  test(
    'audience cannot enable local microphone/camera through media controls',
    () async {
      final engine = Engine();
      final rtc = LiveRtcService(
        engineFactory: () => engine,
        permissionChecker: (_) async {},
      );
      await rtc.connect(
        credentials: proof('SUBSCRIBER'),
        role: LiveRtcRole.audience,
      );
      engine.calls.clear();
      await rtc.setMuted(false);
      await rtc.setCameraEnabled(true);
      await rtc.switchCamera();
      expect(engine.calls, isEmpty);
      expect(engine.options!.publishMicrophoneTrack, false);
      expect(engine.options!.publishCameraTrack, false);
      await rtc.dispose();
    },
  );
  test(
    'concurrent connect during permission wait cannot create two engines',
    () async {
      final permission = Completer<void>();
      final engine = Engine();
      var created = 0;
      final rtc = LiveRtcService(
        engineFactory: () {
          created++;
          return engine;
        },
        permissionChecker: (_) => permission.future,
      );
      final first = rtc.connect(
        credentials: proof('PUBLISHER'),
        role: LiveRtcRole.broadcaster,
      );
      await expectLater(
        rtc.connect(
          credentials: proof('PUBLISHER'),
          role: LiveRtcRole.broadcaster,
        ),
        throwsStateError,
      );
      permission.complete();
      await first;
      expect(created, 1);
      await rtc.dispose();
    },
  );
  test(
    'foreground rejoin retains UID and engine with audience publishing disabled',
    () async {
      final engine = Engine();
      var created = 0;
      final rtc = LiveRtcService(
        engineFactory: () {
          created++;
          return engine;
        },
        permissionChecker: (_) async {},
      );
      await rtc.connect(
        credentials: proof('SUBSCRIBER'),
        role: LiveRtcRole.audience,
      );
      await rtc.leave();
      await rtc.rejoin(proof('SUBSCRIBER'));
      expect(created, 1);
      expect(engine.calls.where((c) => c == #joinChannel).length, 2);
      expect(engine.options!.publishMicrophoneTrack, false);
      expect(engine.options!.publishCameraTrack, false);
      await expectLater(rtc.rejoin(proof('PUBLISHER')), throwsStateError);
      await rtc.dispose();
    },
  );
  test(
    'host camera/microphone events update audience without local publishing',
    () async {
      final engine = Engine();
      final service = LiveRtcService(
        engineFactory: () => engine,
        permissionChecker: (_) async {},
      );
      await service.connect(
        credentials: proof('SUBSCRIBER'),
        role: LiveRtcRole.audience,
      );
      const connection = RtcConnection(localUid: 42);
      engine.handler!.onUserJoined!(connection, 99, 0);
      engine.handler!.onUserMuteVideo!(connection, 99, true);
      engine.handler!.onUserMuteAudio!(connection, 99, true);
      expect(service.remoteCameraEnabled, isFalse);
      expect(service.remoteAudioMuted, isTrue);
      expect(engine.options!.publishMicrophoneTrack, isFalse);
      expect(engine.options!.publishCameraTrack, isFalse);
      await service.dispose();
    },
  );
  for (final role in LiveRtcRole.values) {
    test('correct $role publishing/subscription and camera controls', () async {
      final engine = Engine();
      final service = LiveRtcService(
        engineFactory: () => engine,
        permissionChecker: (_) async {},
      );
      await service.connect(
        credentials: proof(
          role == LiveRtcRole.broadcaster ? 'PUBLISHER' : 'SUBSCRIBER',
        ),
        role: role,
      );
      expect(
        engine.options!.publishMicrophoneTrack,
        role == LiveRtcRole.broadcaster,
      );
      expect(
        engine.options!.publishCameraTrack,
        role == LiveRtcRole.broadcaster,
      );
      expect(engine.options!.autoSubscribeAudio, isTrue);
      expect(engine.options!.autoSubscribeVideo, isTrue);
      await service.setSpeakerEnabled(false);
      expect(service.isSpeakerEnabled, isFalse);
      await service.switchCamera();
      expect(
        engine.calls.contains(#switchCamera),
        role == LiveRtcRole.broadcaster,
      );
      await service.setMuted(true);
      await service.setCameraEnabled(false);
      await service.switchCamera();
      expect(service.isMuted, isTrue);
      expect(service.isCameraEnabled, isFalse);
      if (role == LiveRtcRole.audience) {
        expect(engine.calls, isNot(contains(#muteLocalAudioStream)));
      }
      await service.dispose();
      expect(engine.calls, contains(#release));
    });
  }
  test('permission denial does not create engine', () async {
    var created = false;
    final service = LiveRtcService(
      engineFactory: () {
        created = true;
        return Engine();
      },
      permissionChecker: (_) async => throw StateError('permission denied'),
    );
    await expectLater(
      service.connect(
        credentials: proof('PUBLISHER'),
        role: LiveRtcRole.broadcaster,
      ),
      throwsStateError,
    );
    expect(created, isFalse);
  });
  test('mismatched publisher credentials rejected for audience', () async {
    final service = LiveRtcService(
      engineFactory: () => Engine(),
      permissionChecker: (_) async {},
    );
    await expectLater(
      service.connect(
        credentials: proof('PUBLISHER'),
        role: LiveRtcRole.audience,
      ),
      throwsStateError,
    );
  });
  test('failed join releases engine', () async {
    final engine = Engine()..failJoin = true;
    final service = LiveRtcService(
      engineFactory: () => engine,
      permissionChecker: (_) async {},
    );
    await expectLater(
      service.connect(
        credentials: proof('SUBSCRIBER'),
        role: LiveRtcRole.audience,
      ),
      throwsStateError,
    );
    expect(engine.calls, contains(#release));
    expect(service.engine, isNull);
  });
  test('leaving a pending join still leaves SDK channel', () async {
    final engine = Engine();
    final service = LiveRtcService(
      engineFactory: () => engine,
      permissionChecker: (_) async {},
    );
    await service.connect(
      credentials: proof('SUBSCRIBER'),
      role: LiveRtcRole.audience,
    );
    expect(service.isJoined, isFalse);
    await service.leave();
    expect(engine.calls, contains(#leaveChannel));
    await service.dispose();
  });
  test(
    'dispose during permission wait prevents later engine startup',
    () async {
      final permissions = Completer<void>();
      var created = false;
      final service = LiveRtcService(
        engineFactory: () {
          created = true;
          return Engine();
        },
        permissionChecker: (_) => permissions.future,
      );
      final connect = service.connect(
        credentials: proof('PUBLISHER'),
        role: LiveRtcRole.broadcaster,
      );
      final assertion = expectLater(connect, throwsStateError);
      await service.dispose();
      permissions.complete();
      await assertion;
      expect(created, isFalse);
    },
  );
  test('disconnected and failed states are never reported connected', () async {
    final engine = Engine();
    final service = LiveRtcService(
      engineFactory: () => engine,
      permissionChecker: (_) async {},
    );
    await service.connect(
      credentials: proof('SUBSCRIBER'),
      role: LiveRtcRole.audience,
    );
    engine.handler!.onJoinChannelSuccess!(const RtcConnection(localUid: 42), 0);
    for (final state in [
      ConnectionStateType.connectionStateConnected,
      ConnectionStateType.connectionStateDisconnected,
      ConnectionStateType.connectionStateFailed,
    ]) {
      engine.handler!.onConnectionStateChanged!(
        const RtcConnection(localUid: 42),
        state,
        ConnectionChangedReasonType.connectionChangedConnecting,
      );
      expect(
        service.isConnected,
        state == ConnectionStateType.connectionStateConnected,
      );
    }
    await service.dispose();
  });
  test(
    'simultaneous token-expiry callbacks share one renewal request',
    () async {
      final engine = Engine();
      final service = LiveRtcService(
        engineFactory: () => engine,
        permissionChecker: (_) async {},
      );
      await service.connect(
        credentials: proof('SUBSCRIBER'),
        role: LiveRtcRole.audience,
      );
      final renewal = Completer<String?>();
      var requests = 0;
      service.onTokenRenewalRequested = () {
        requests++;
        return renewal.future;
      };
      engine.handler!.onRequestToken!(const RtcConnection(localUid: 42));
      engine.handler!.onRequestToken!(const RtcConnection(localUid: 42));
      expect(requests, 1);
      renewal.complete('mock-renewed');
      await Future<void>.delayed(Duration.zero);
      expect(engine.calls.where((call) => call == #renewToken).length, 1);
      await service.dispose();
    },
  );
}
