import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

import 'live_models.dart';

enum LiveRtcRole { broadcaster, audience }

enum LiveRtcConnectionState {
  idle,
  preparing,
  joining,
  connected,
  reconnecting,
  failed,
  left,
}

class LiveRtcService {
  RtcEngine? _engine;

  LiveRtcRole? _role;
  LiveRtcCredentials? _credentials;

  LiveRtcConnectionState _state = LiveRtcConnectionState.idle;

  int? _localUid;
  int? _remoteUid;

  bool _joined = false;
  bool _muted = false;
  bool _cameraEnabled = true;
  bool _speakerEnabled = true;

  void Function()? onChanged;
  void Function(String message)? onError;
  Future<String?> Function()? onTokenRenewalRequested;

  RtcEngine? get engine => _engine;

  LiveRtcRole? get role => _role;

  LiveRtcCredentials? get credentials => _credentials;

  LiveRtcConnectionState get state => _state;

  int? get localUid => _localUid;

  int? get remoteUid => _remoteUid;

  bool get isJoined => _joined;

  bool get isConnected => state == LiveRtcConnectionState.connected;

  bool get isMuted => _muted;

  bool get isCameraEnabled => _cameraEnabled;

  bool get isSpeakerEnabled => _speakerEnabled;

  Future<void> connect({
    required LiveRtcCredentials credentials,
    required LiveRtcRole role,
  }) async {
    _credentials = credentials;
    _role = role;

    _setState(LiveRtcConnectionState.preparing);

    try {
      await _ensurePermissions(role);

      debugPrint('LIVE_RTC_ENGINE_CREATE');

      final engine = createAgoraRtcEngine();

      debugPrint('LIVE_RTC_ENGINE_CREATED');

      debugPrint('LIVE_RTC_ENGINE_INIT_START');

      await engine.initialize(
        RtcEngineContext(
          appId: credentials.appId.trim(),
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
        ),
      );

      _engine = engine;

      _registerHandlers(engine);

      await engine.enableAudio();
      debugPrint('LIVE_RTC_ENGINE_INIT_OK');

      try {
        await engine.setEnableSpeakerphone(true);

        debugPrint('LIVE_RTC_SPEAKER_OK');
      } on AgoraRtcException catch (error) {
        // On some Android devices/emulators Agora can return -3 while
        // the audio route is still being created. Speaker routing must
        // never abort the live video broadcast startup.
        debugPrint('LIVE_RTC_SPEAKER_SKIPPED code=${error.code}');
      }

      if (role == LiveRtcRole.broadcaster) {
        try {
          await engine.setCameraCapturerConfiguration(
            const CameraCapturerConfiguration(
              cameraDirection: CameraDirection.cameraFront,
              followEncodeDimensionRatio: true,
              format: VideoFormat(width: 1280, height: 720, fps: 30),
            ),
          );

          debugPrint('LIVE_BROADCAST_CAMERA_CONFIG_OK');
        } on AgoraRtcException catch (error) {
          debugPrint(
            'LIVE_BROADCAST_CAMERA_CONFIG_FALLBACK code=${error.code}',
          );
        }

        debugPrint('LIVE_RTC_ENABLE_VIDEO_START');

        await engine.enableVideo();

        debugPrint('LIVE_RTC_ENABLE_VIDEO_OK');

        await engine.enableAudio();
        await engine.enableLocalAudio(true);
        await engine.enableLocalVideo(true);

        _muted = false;
        _cameraEnabled = true;

        debugPrint('LIVE_BROADCAST_LOCAL_MEDIA_OK');
        await engine.enableLocalVideo(true);
        try {
          await engine.setVideoEncoderConfiguration(
            const VideoEncoderConfiguration(
              dimensions: VideoDimensions(width: 1280, height: 720),
              frameRate: 30,
              bitrate: 0,
              minBitrate: 600,
              orientationMode: OrientationMode.orientationModeAdaptive,
              degradationPreference: DegradationPreference.maintainBalanced,
            ),
          );

          debugPrint('LIVE_BROADCAST_ENCODER_OK');
        } on AgoraRtcException catch (error) {
          debugPrint('LIVE_BROADCAST_ENCODER_FALLBACK code=${error.code}');
        }

        debugPrint('LIVE_RTC_PREVIEW_START');

        await engine.startPreview();

        debugPrint('LIVE_RTC_PREVIEW_OK');

        try {
          await engine.setCameraAutoFocusFaceModeEnabled(true);
          debugPrint('LIVE_BROADCAST_AUTOFOCUS_OK');
        } on AgoraRtcException catch (error) {
          debugPrint('LIVE_BROADCAST_AUTOFOCUS_FALLBACK code=${error.code}');
        }

        _cameraEnabled = true;
      } else {
        // Audience only receives the live stream.
        // It must never publish camera or microphone tracks.
        await engine.disableVideo();
        _cameraEnabled = false;
        _muted = true;
      }

      _setState(LiveRtcConnectionState.joining);

      debugPrint(
        'LIVE_RTC_JOIN_START '
        'channel=${credentials.channelName} '
        'uid=${credentials.uid}',
      );

      await engine.joinChannel(
        token: credentials.token.trim(),
        channelId: credentials.channelName.trim(),
        uid: credentials.uid,
        options: ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
          clientRoleType: role == LiveRtcRole.broadcaster
              ? ClientRoleType.clientRoleBroadcaster
              : ClientRoleType.clientRoleAudience,
          publishMicrophoneTrack: role == LiveRtcRole.broadcaster,
          publishCameraTrack: role == LiveRtcRole.broadcaster,
          autoSubscribeAudio: true,
          autoSubscribeVideo: true,
        ),
      );
    } catch (error, stackTrace) {
      debugPrint('LIVE_RTC_CONNECT_FAILED: $error');

      debugPrintStack(label: 'LIVE_RTC_CONNECT_STACK', stackTrace: stackTrace);

      _setState(LiveRtcConnectionState.failed);
      onError?.call(error.toString());
      rethrow;
    }
  }

  Future<void> _ensurePermissions(LiveRtcRole role) async {
    if (role != LiveRtcRole.broadcaster) {
      return;
    }

    final microphone = await Permission.microphone.request();

    if (!microphone.isGranted) {
      throw StateError('Microphone permission is required to go live.');
    }

    final camera = await Permission.camera.request();

    if (!camera.isGranted) {
      throw StateError('Camera permission is required to go live.');
    }
  }

  void _registerHandlers(RtcEngine engine) {
    engine.registerEventHandler(
      RtcEngineEventHandler(
        onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
          _joined = true;
          _localUid = connection.localUid;

          debugPrint('LIVE_RTC_JOINED_OK localUid=${connection.localUid}');

          _setState(LiveRtcConnectionState.connected);
        },
        onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
          if (remoteUid > 0) {
            _remoteUid = remoteUid;

            debugPrint('LIVE_RTC_REMOTE_USER_JOINED uid=$remoteUid');
            _notify();
          }
        },
        onUserOffline:
            (
              RtcConnection connection,
              int remoteUid,
              UserOfflineReasonType reason,
            ) {
              if (_remoteUid == remoteUid) {
                _remoteUid = null;
                _notify();
              }
            },
        onConnectionStateChanged:
            (
              RtcConnection connection,
              ConnectionStateType state,
              ConnectionChangedReasonType reason,
            ) {
              final normalized = state.toString().toLowerCase();

              if (normalized.contains('reconnecting')) {
                _setState(LiveRtcConnectionState.reconnecting);
                return;
              }

              if (normalized.contains('connected')) {
                _joined = true;
                _setState(LiveRtcConnectionState.connected);
              }
            },
        onConnectionLost: (RtcConnection connection) {
          _setState(LiveRtcConnectionState.reconnecting);
        },
        onRejoinChannelSuccess: (RtcConnection connection, int elapsed) {
          _joined = true;
          _localUid = connection.localUid;

          debugPrint('LIVE_RTC_JOINED_OK localUid=${connection.localUid}');

          _setState(LiveRtcConnectionState.connected);
        },
        onTokenPrivilegeWillExpire: (RtcConnection connection, String token) {
          _renewToken();
        },
        onRequestToken: (RtcConnection connection) {
          _renewToken();
        },
        onError: (ErrorCodeType errorCode, String message) {
          final normalized = message.trim();

          debugPrint(
            'LIVE_RTC_AGORA_ERROR code=$errorCode message=$normalized',
          );

          onError?.call(
            normalized.isEmpty ? 'Agora live error: $errorCode' : normalized,
          );
        },
      ),
    );
  }

  Future<void> _renewToken() async {
    final callback = onTokenRenewalRequested;

    if (callback == null) {
      return;
    }

    try {
      final token = (await callback())?.trim() ?? '';

      if (token.isEmpty || _engine == null) {
        return;
      }

      await _engine!.renewToken(token);
    } catch (error) {
      onError?.call('Unable to renew live-session token: $error');
    }
  }

  Future<void> setMuted(bool muted) async {
    if (_role != LiveRtcRole.broadcaster) {
      return;
    }

    final engine = _engine;

    if (engine == null) {
      return;
    }

    await engine.muteLocalAudioStream(muted);

    _muted = muted;
    _notify();
  }

  Future<void> setCameraEnabled(bool enabled) async {
    if (_role != LiveRtcRole.broadcaster) {
      return;
    }

    final engine = _engine;

    if (engine == null) {
      return;
    }

    await engine.enableLocalVideo(enabled);
    await engine.muteLocalVideoStream(!enabled);

    if (enabled) {
      await engine.startPreview();
    } else {
      await engine.stopPreview();
    }

    _cameraEnabled = enabled;
    _notify();
  }

  Future<void> switchCamera() async {
    if (_role != LiveRtcRole.broadcaster ||
        !_cameraEnabled ||
        _engine == null) {
      return;
    }

    await _engine!.switchCamera();
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    final engine = _engine;

    if (engine == null) {
      return;
    }

    await engine.setEnableSpeakerphone(enabled);

    _speakerEnabled = enabled;
    _notify();
  }

  Future<void> renewToken(String token) async {
    final normalized = token.trim();

    if (_engine == null || normalized.isEmpty) {
      return;
    }

    await _engine!.renewToken(normalized);
  }

  Future<void> leave() async {
    final engine = _engine;

    if (engine == null) {
      _joined = false;
      _setState(LiveRtcConnectionState.left);
      return;
    }

    if (_role == LiveRtcRole.broadcaster) {
      try {
        await engine.stopPreview();
      } catch (_) {
        // Preview may already be stopped.
      }
    }

    if (_joined) {
      await engine.leaveChannel();
    }

    _joined = false;
    _remoteUid = null;

    _setState(LiveRtcConnectionState.left);
  }

  Future<void> dispose() async {
    final engine = _engine;

    if (engine == null) {
      return;
    }

    try {
      await leave();
    } finally {
      await engine.release();

      _engine = null;
      _role = null;
      _credentials = null;

      _joined = false;

      _localUid = null;
      _remoteUid = null;

      _muted = false;
      _cameraEnabled = true;
      _speakerEnabled = true;

      onChanged = null;
      onError = null;
      onTokenRenewalRequested = null;
    }
  }

  void _setState(LiveRtcConnectionState value) {
    _state = value;
    _notify();
  }

  void _notify() {
    onChanged?.call();
  }
}
