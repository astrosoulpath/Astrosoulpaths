import 'dart:async';

import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

typedef VideoUidCallback = void Function(int uid);
typedef VideoConnectionCallback =
    void Function(
      ConnectionStateType state,
      ConnectionChangedReasonType reason,
    );

class AgoraVideoService {
  RtcEngine? _engine;

  bool _initialized = false;
  bool _joined = false;
  bool _muted = false;
  bool _cameraEnabled = true;
  bool _speakerEnabled = true;

  Timer? _remoteSubscribeRetryTimer;

  VideoUidCallback? onLocalJoined;
  VideoUidCallback? onRemoteJoined;
  VideoUidCallback? onRemoteLeft;
  VideoConnectionCallback? onConnectionStateChanged;
  void Function()? onTokenWillExpire;
  void Function(String message)? onError;

  RtcEngine? get engine => _engine;

  bool get isInitialized => _initialized;
  bool get isJoined => _joined;
  bool get isMuted => _muted;
  bool get isCameraEnabled => _cameraEnabled;
  bool get isSpeakerEnabled => _speakerEnabled;

  Future<void> initialize({required String appId}) async {
    if (_initialized) {
      return;
    }

    final normalizedAppId = appId.trim();

    if (normalizedAppId.isEmpty) {
      throw StateError('Agora App ID is required for video consultation.');
    }

    final microphoneStatus = await Permission.microphone.request();

    if (!microphoneStatus.isGranted) {
      throw StateError(
        'Microphone permission is required for video consultation.',
      );
    }

    final cameraStatus = await Permission.camera.request();

    if (!cameraStatus.isGranted) {
      throw StateError('Camera permission is required for video consultation.');
    }

    final rtcEngine = createAgoraRtcEngine();

    await rtcEngine.initialize(
      RtcEngineContext(
        appId: normalizedAppId,
        channelProfile: ChannelProfileType.channelProfileCommunication,
      ),
    );

    rtcEngine.registerEventHandler(
      RtcEngineEventHandler(
        onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
          _joined = true;

          final uid = connection.localUid ?? 0;

          if (uid > 0) {
            onLocalJoined?.call(uid);
          }
        },
        onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
          if (remoteUid > 0) {
            debugPrint(
              'VIDEO_RTC_REMOTE_USER_JOIN_EVENT '
              'uid=$remoteUid channel=${connection.channelId}',
            );

            rtcEngine
                .muteRemoteVideoStream(uid: remoteUid, mute: false)
                .then((_) {
                  debugPrint('VIDEO_REMOTE_SUBSCRIBE_REQUEST uid=$remoteUid');
                })
                .catchError((Object error) {
                  debugPrint(
                    'VIDEO_REMOTE_SUBSCRIBE_WARNING '
                    'uid=$remoteUid error=$error',
                  );
                });

            _remoteSubscribeRetryTimer?.cancel();

            _remoteSubscribeRetryTimer = Timer(
              const Duration(seconds: 2),
              () async {
                if (!_joined || _engine != rtcEngine) {
                  debugPrint(
                    'VIDEO_REMOTE_SUBSCRIBE_RETRY_SKIPPED '
                    'uid=$remoteUid joined=$_joined',
                  );
                  return;
                }

                try {
                  await rtcEngine.muteRemoteVideoStream(
                    uid: remoteUid,
                    mute: false,
                  );

                  debugPrint('VIDEO_REMOTE_SUBSCRIBE_RETRY_OK uid=$remoteUid');
                } catch (error) {
                  debugPrint(
                    'VIDEO_REMOTE_SUBSCRIBE_RETRY_WARNING '
                    'uid=$remoteUid error=$error',
                  );
                }
              },
            );

            onRemoteJoined?.call(remoteUid);
          }
        },
        onRemoteVideoStateChanged:
            (
              RtcConnection connection,
              int remoteUid,
              RemoteVideoState state,
              RemoteVideoStateReason reason,
              int elapsed,
            ) {
              debugPrint(
                'VIDEO_REMOTE_STATE '
                'uid=$remoteUid '
                'state=$state '
                'reason=$reason '
                'channel=${connection.channelId}',
              );
            },

        onFirstRemoteVideoFrame:
            (
              RtcConnection connection,
              int remoteUid,
              int width,
              int height,
              int elapsed,
            ) {
              debugPrint(
                'VIDEO_REMOTE_FIRST_FRAME '
                'uid=$remoteUid '
                'size=${width}x$height '
                'channel=${connection.channelId}',
              );
            },

        onUserOffline:
            (
              RtcConnection connection,
              int remoteUid,
              UserOfflineReasonType reason,
            ) {
              if (remoteUid > 0) {
                onRemoteLeft?.call(remoteUid);
              }
            },
        onConnectionStateChanged:
            (
              RtcConnection connection,
              ConnectionStateType state,
              ConnectionChangedReasonType reason,
            ) {
              onConnectionStateChanged?.call(state, reason);
            },
        onConnectionLost: (RtcConnection connection) {
          onConnectionStateChanged?.call(
            ConnectionStateType.connectionStateReconnecting,
            ConnectionChangedReasonType.connectionChangedInterrupted,
          );
        },
        onRejoinChannelSuccess: (RtcConnection connection, int elapsed) {
          _joined = true;

          onConnectionStateChanged?.call(
            ConnectionStateType.connectionStateConnected,
            ConnectionChangedReasonType.connectionChangedJoinSuccess,
          );
        },
        onTokenPrivilegeWillExpire: (RtcConnection connection, String token) {
          onTokenWillExpire?.call();
        },
        onRequestToken: (RtcConnection connection) {
          onTokenWillExpire?.call();
        },
        onError: (ErrorCodeType errorCodeType, String message) {
          onError?.call(
            message.trim().isEmpty
                ? 'Agora video error: $errorCodeType'
                : message,
          );
        },
      ),
    );

    await rtcEngine.enableAudio();
    // Production camera configuration.
    // Android/iOS resolve this to the device's real front camera.
    // On an emulator, the emulator-provided camera source is used.
    try {
      await rtcEngine.setCameraCapturerConfiguration(
        const CameraCapturerConfiguration(
          cameraDirection: CameraDirection.cameraFront,
          followEncodeDimensionRatio: true,
          format: VideoFormat(width: 1280, height: 720, fps: 30),
        ),
      );

      debugPrint('AGORA_PRODUCTION_CAMERA_CONFIG_OK');
    } on AgoraRtcException catch (error) {
      // Do not kill the call if a specific emulator/device does not
      // support an explicit capture profile. Agora can use its default
      // device camera configuration instead.
      debugPrint('AGORA_PRODUCTION_CAMERA_CONFIG_FALLBACK code=${error.code}');
    }

    await rtcEngine.enableVideo();

    await rtcEngine.enableLocalVideo(true);
    await rtcEngine.muteLocalVideoStream(false);

    debugPrint('AGORA_LOCAL_VIDEO_EXPLICIT_ENABLED');

    debugPrint('AGORA_VIDEO_HD_ENCODER_START');

    await rtcEngine.setVideoEncoderConfiguration(
      const VideoEncoderConfiguration(
        dimensions: VideoDimensions(width: 1280, height: 720),
        frameRate: 30,
        bitrate: 0,
        minBitrate: 600,
        orientationMode: OrientationMode.orientationModeAdaptive,
        degradationPreference: DegradationPreference.maintainBalanced,
      ),
    );

    debugPrint('AGORA_VIDEO_HD_ENCODER_OK');

    try {
      await rtcEngine.setEnableSpeakerphone(true);
      _speakerEnabled = true;
    } on AgoraRtcException catch (error) {
      // Some Android/emulator audio routes can report -3 during startup.
      // This must not prevent the RTC engine from joining the video channel.
      debugPrint('AGORA_VIDEO_SPEAKER_INIT_SKIPPED code=${error.code}');
      _speakerEnabled = true;
    }

    await rtcEngine.startPreview();

    try {
      await rtcEngine.setCameraAutoFocusFaceModeEnabled(true);
      debugPrint('AGORA_PRODUCTION_AUTOFOCUS_OK');
    } on AgoraRtcException catch (error) {
      debugPrint('AGORA_PRODUCTION_AUTOFOCUS_FALLBACK code=${error.code}');
    }

    _engine = rtcEngine;
    _initialized = true;
    _speakerEnabled = true;
    _cameraEnabled = true;
    _muted = false;
  }

  Future<void> join({
    required String token,
    required String channelName,
    required int uid,
  }) async {
    final rtcEngine = _engine;

    if (!_initialized || rtcEngine == null) {
      throw StateError(
        'Agora video engine must be initialized before joining.',
      );
    }

    final normalizedToken = token.trim();
    final normalizedChannel = channelName.trim();

    if (normalizedToken.isEmpty) {
      throw StateError('Agora video token is required.');
    }

    if (normalizedChannel.isEmpty) {
      throw StateError('Agora video channel name is required.');
    }

    if (uid <= 0) {
      throw StateError('Agora video UID must be greater than zero.');
    }

    await rtcEngine.joinChannel(
      token: normalizedToken,
      channelId: normalizedChannel,
      uid: uid,
      options: const ChannelMediaOptions(
        clientRoleType: ClientRoleType.clientRoleBroadcaster,
        channelProfile: ChannelProfileType.channelProfileCommunication,
        publishMicrophoneTrack: true,
        publishCameraTrack: true,
        autoSubscribeAudio: true,
        autoSubscribeVideo: true,
      ),
    );
  }

  Future<void> setMuted(bool muted) async {
    final rtcEngine = _engine;

    if (rtcEngine == null) {
      debugPrint('VIDEO_MIC_TOGGLE_SKIPPED engine=null requested=$muted');
      return;
    }

    debugPrint('VIDEO_MIC_TOGGLE_START muted=$muted');

    try {
      await rtcEngine.muteLocalAudioStream(muted);
      _muted = muted;
      debugPrint('VIDEO_MIC_TOGGLE_OK muted=$muted');
    } on AgoraRtcException catch (error) {
      debugPrint('VIDEO_MIC_TOGGLE_FAILED muted=$muted code=${error.code}');
      rethrow;
    }
  }

  Future<void> setCameraEnabled(bool enabled) async {
    final rtcEngine = _engine;

    if (rtcEngine == null) {
      return;
    }

    await rtcEngine.muteLocalVideoStream(!enabled);
    await rtcEngine.enableLocalVideo(enabled);

    _cameraEnabled = enabled;
  }

  Future<void> switchCamera() async {
    final rtcEngine = _engine;

    if (rtcEngine == null || !_cameraEnabled) {
      return;
    }

    await rtcEngine.switchCamera();
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    final rtcEngine = _engine;

    if (rtcEngine == null) {
      debugPrint('VIDEO_SPEAKER_TOGGLE_SKIPPED engine=null requested=$enabled');
      return;
    }

    debugPrint('VIDEO_SPEAKER_TOGGLE_START enabled=$enabled');

    try {
      await rtcEngine.setEnableSpeakerphone(enabled);
      _speakerEnabled = enabled;
      debugPrint('VIDEO_SPEAKER_TOGGLE_OK enabled=$enabled');
    } on AgoraRtcException catch (error) {
      debugPrint(
        'VIDEO_SPEAKER_TOGGLE_FAILED enabled=$enabled code=${error.code}',
      );
      rethrow;
    }
  }

  Future<void> renewToken(String token) async {
    final rtcEngine = _engine;
    final normalizedToken = token.trim();

    if (rtcEngine == null || normalizedToken.isEmpty) {
      return;
    }

    await rtcEngine.renewToken(normalizedToken);
  }

  Future<void> leave() async {
    _remoteSubscribeRetryTimer?.cancel();
    _remoteSubscribeRetryTimer = null;

    debugPrint('VIDEO_REMOTE_SUBSCRIBE_RETRY_CANCELLED_ON_LEAVE');

    final rtcEngine = _engine;

    if (rtcEngine == null) {
      _joined = false;
      return;
    }

    try {
      await rtcEngine.stopPreview();
    } catch (_) {
      // Preview may already be stopped during disconnect/recovery.
    }

    if (_joined) {
      await rtcEngine.leaveChannel();
    }

    _joined = false;
  }

  Future<void> dispose() async {
    final rtcEngine = _engine;

    if (rtcEngine == null) {
      return;
    }

    try {
      await leave();
    } finally {
      await rtcEngine.release();

      _engine = null;
      _initialized = false;
      _joined = false;
      _muted = false;
      _cameraEnabled = true;
      _speakerEnabled = true;

      onLocalJoined = null;
      onRemoteJoined = null;
      onRemoteLeft = null;
      onConnectionStateChanged = null;
      onTokenWillExpire = null;
      onError = null;
    }
  }
}
