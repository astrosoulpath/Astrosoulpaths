import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';
import 'package:permission_handler/permission_handler.dart';

typedef AgoraLocalJoinCallback = void Function(int uid);
typedef AgoraRemoteJoinCallback = void Function(int uid);
typedef AgoraRemoteLeaveCallback = void Function(int uid);
typedef AgoraConnectionStateCallback =
    void Function(
      ConnectionStateType state,
      ConnectionChangedReasonType reason,
    );
typedef AgoraErrorCallback = void Function(String message);
typedef AgoraTokenExpiringCallback = void Function();

class AgoraAudioService {
  RtcEngine? _engine;

  bool _initialized = false;
  bool _joining = false;
  bool _joined = false;
  bool _muted = false;
  bool _speakerEnabled = true;

  String? _channelName;

  int? _localUid;
  AgoraLocalJoinCallback? onLocalJoined;
  AgoraRemoteJoinCallback? onRemoteJoined;
  AgoraRemoteLeaveCallback? onRemoteLeft;
  AgoraConnectionStateCallback? onConnectionStateChanged;
  AgoraErrorCallback? onError;
  AgoraTokenExpiringCallback? onTokenWillExpire;

  bool get isInitialized => _initialized;
  bool get isJoined => _joined;
  bool get isMuted => _muted;
  bool get isSpeakerEnabled => _speakerEnabled;
  String? get channelName => _channelName;

  Future<void> initialize({required String appId}) async {
    if (_initialized) {
      return;
    }

    final normalizedAppId = appId.trim();

    if (normalizedAppId.isEmpty) {
      throw ArgumentError('Agora App ID is required.');
    }

    final engine = createAgoraRtcEngine();

    await engine.initialize(
      RtcEngineContext(
        appId: normalizedAppId,
        channelProfile: ChannelProfileType.channelProfileCommunication,
      ),
    );

    engine.registerEventHandler(
      RtcEngineEventHandler(
        onAudioVolumeIndication:
            (
              RtcConnection connection,
              List<AudioVolumeInfo> speakers,
              int speakerNumber,
              int totalVolume,
            ) {
              for (final info in speakers) {
                final uid = info.uid ?? -1;
                final volume = info.volume ?? 0;
                final vad = info.vad ?? 0;

                if (uid == 0) {
                  debugPrint(
                    'AGORA_AUDIO_LOCAL_LEVEL '
                    'channel=${connection.channelId} '
                    'volume=$volume '
                    'vad=$vad',
                  );
                } else {
                  debugPrint(
                    'AGORA_AUDIO_REMOTE_LEVEL '
                    'channel=${connection.channelId} '
                    'uid=$uid '
                    'volume=$volume',
                  );
                }
              }

              debugPrint(
                'AGORA_AUDIO_VOLUME '
                'channel=${connection.channelId} '
                'localUid=${connection.localUid} '
                'speakers=$speakerNumber '
                'totalVolume=$totalVolume',
              );
            },
        onJoinChannelSuccess: (RtcConnection connection, int elapsed) {
          _joining = false;

          _joined = true;

          final uid = connection.localUid;
          _localUid = uid;

          _muted = false;

          debugPrint(
            'AGORA_AUDIO_JOIN_STATE_RESET muted=false '
            'channel=$_channelName uid=$uid',
          );

          debugPrint(
            'AGORA_AUDIO_LOCAL_JOINED channel=${connection.channelId} uid=$uid',
          );

          if (uid != null) {
            onLocalJoined?.call(uid);
          }
        },
        onUserJoined: (RtcConnection connection, int remoteUid, int elapsed) {
          debugPrint(
            'AGORA_AUDIO_REMOTE_JOINED channel=${connection.channelId} uid=$remoteUid',
          );

          onRemoteJoined?.call(remoteUid);
        },
        onUserOffline:
            (
              RtcConnection connection,
              int remoteUid,
              UserOfflineReasonType reason,
            ) {
              debugPrint(
                'AGORA_AUDIO_REMOTE_LEFT channel=${connection.channelId} '
                'uid=$remoteUid reason=$reason',
              );

              onRemoteLeft?.call(remoteUid);
            },
        onConnectionStateChanged:
            (
              RtcConnection connection,
              ConnectionStateType state,
              ConnectionChangedReasonType reason,
            ) {
              debugPrint(
                'AGORA_AUDIO_CONNECTION channel=${connection.channelId} '
                'state=$state reason=$reason',
              );

              onConnectionStateChanged?.call(state, reason);
            },
        onTokenPrivilegeWillExpire: (RtcConnection connection, String token) {
          debugPrint(
            'AGORA_AUDIO_TOKEN_EXPIRING channel=${connection.channelId}',
          );

          onTokenWillExpire?.call();
        },
        onError: (ErrorCodeType err, String msg) {
          final message = 'Agora error: $err $msg';

          debugPrint(message);
          onError?.call(message);
        },
      ),
    );

    await engine.enableAudio();

    // Explicitly enable the real local microphone capture path.
    // This is shared by Android and iOS and avoids relying on
    // platform-specific Agora defaults.
    await engine.enableLocalAudio(true);

    debugPrint('AGORA_AUDIO_LOCAL_CAPTURE_READY');

    await engine.setAudioProfile(
      profile: AudioProfileType.audioProfileSpeechStandard,
      scenario: AudioScenarioType.audioScenarioDefault,
    );

    debugPrint(
      'AGORA_AUDIO_PROFILE_READY '
      'profile=audioProfileSpeechStandard '
      'scenario=audioScenarioDefault',
    );

    await engine.adjustRecordingSignalVolume(100);
    await engine.adjustPlaybackSignalVolume(100);

    debugPrint('AGORA_AUDIO_GAIN_READY recording=100 playback=100');
    await engine.enableAudioVolumeIndication(
      interval: 500,
      smooth: 3,
      reportVad: true,
    );

    debugPrint('AGORA_AUDIO_VOLUME_INDICATION_READY');

    _engine = engine;
    _initialized = true;
  }

  Future<bool> requestMicrophonePermission() async {
    final currentStatus = await Permission.microphone.status;

    if (currentStatus.isGranted) {
      return true;
    }

    final requestedStatus = await Permission.microphone.request();

    return requestedStatus.isGranted;
  }

  Future<void> join({
    required String token,
    required String channelName,
    required int uid,
  }) async {
    final engine = _engine;

    if (!_initialized || engine == null) {
      throw StateError('AgoraAudioService must be initialized before joining.');
    }

    final normalizedToken = token.trim();
    final normalizedChannel = channelName.trim();

    if (normalizedToken.isEmpty) {
      throw ArgumentError('Agora token is required.');
    }

    if (normalizedChannel.isEmpty) {
      throw ArgumentError('Agora channel name is required.');
    }

    if (uid <= 0) {
      throw ArgumentError('Agora UID must be greater than zero.');
    }

    /*
     * Same CallSession + same Agora identity:
     * never start another native join while joining/connected.
     */
    if ((_joining || _joined) &&
        _channelName == normalizedChannel &&
        _localUid == uid) {
      debugPrint(
        'AGORA_AUDIO_JOIN_SKIPPED '
        'channel=$normalizedChannel '
        'uid=$uid '
        'joining=$_joining '
        'joined=$_joined',
      );

      return;
    }

    /*
     * Switching RTC identity requires leaving the previous
     * channel first.
     */
    if (_joining || _joined || (_channelName?.trim().isNotEmpty ?? false)) {
      await leave();
    }

    final hasMicrophonePermission = await requestMicrophonePermission();

    if (!hasMicrophonePermission) {
      throw StateError('Microphone permission is required for audio calling.');
    }

    _joining = true;
    _joined = false;
    _channelName = normalizedChannel;
    _localUid = uid;

    _muted = false;

    debugPrint(
      'AGORA_AUDIO_JOIN_STATE_RESET muted=false '
      'channel=$_channelName uid=$uid',
    );

    try {
      // Production safety: every consultation begins with the
      // microphone capture enabled and local publishing unmuted.
      await engine.enableAudio();
      await engine.enableLocalAudio(true);
      await engine.muteLocalAudioStream(false);

      debugPrint('AGORA_AUDIO_PREJOIN_MIC_READY');
      await engine.joinChannel(
        token: normalizedToken,
        channelId: normalizedChannel,
        uid: uid,
        options: const ChannelMediaOptions(
          channelProfile: ChannelProfileType.channelProfileCommunication,
          clientRoleType: ClientRoleType.clientRoleBroadcaster,
          enableAudioRecordingOrPlayout: true,
          publishMicrophoneTrack: true,
          autoSubscribeAudio: true,
        ),
      );

      if (!kIsWeb) {
        try {
          await engine.setEnableSpeakerphone(_speakerEnabled);

          debugPrint(
            'AGORA_AUDIO_ROUTE_READY '
            'speaker=$_speakerEnabled',
          );
        } on AgoraRtcException catch (error) {
          debugPrint(
            'AGORA_AUDIO_ROUTE_WARNING '
            'code=${error.code} '
            'message=${error.message}',
          );
        }
      }
    } catch (_) {
      _joining = false;
      _joined = false;
      _channelName = null;
      _localUid = null;

      rethrow;
    }
  }

  Future<void> setMuted(bool muted) async {
    final engine = _engine;

    if (engine == null) {
      throw StateError('Agora engine is not initialized.');
    }

    await engine.muteLocalAudioStream(muted);

    _muted = muted;
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    final engine = _engine;

    if (engine == null) {
      throw StateError('Agora engine is not initialized.');
    }

    if (!kIsWeb) {
      await engine.setEnableSpeakerphone(enabled);
    }

    _speakerEnabled = enabled;
  }

  Future<void> renewToken(String token) async {
    final engine = _engine;

    if (engine == null) {
      throw StateError('Agora engine is not initialized.');
    }

    final normalizedToken = token.trim();

    if (normalizedToken.isEmpty) {
      throw ArgumentError('Agora token is required.');
    }

    await engine.renewToken(normalizedToken);
  }

  Future<void> leave() async {
    final engine = _engine;

    final hadRtcState =
        _joining || _joined || (_channelName?.trim().isNotEmpty ?? false);

    /*
     * Invalidate local RTC identity before waiting on native leave.
     */
    _joining = false;
    _joined = false;
    _channelName = null;
    _localUid = null;

    if (engine == null || !hadRtcState) {
      return;
    }

    try {
      await engine.leaveChannel();
    } on AgoraRtcException catch (error) {
      debugPrint(
        'AGORA_AUDIO_LEAVE_WARNING '
        'code=${error.code} '
        'message=${error.message}',
      );
    }
  }

  Future<void> dispose() async {
    final engine = _engine;

    if (engine == null) {
      return;
    }

    if (_joined) {
      await engine.leaveChannel();
    }

    await engine.release();

    _engine = null;
    _initialized = false;
    _joining = false;
    _joined = false;
    _muted = false;
    _speakerEnabled = true;
    _channelName = null;
    _localUid = null;

    onLocalJoined = null;
    onRemoteJoined = null;
    onRemoteLeft = null;
    onConnectionStateChanged = null;
    onError = null;
    onTokenWillExpire = null;
  }
}
