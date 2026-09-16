import 'package:agora_rtc_engine/agora_rtc_engine.dart';
import 'package:flutter/foundation.dart';

import 'agora_video_service.dart';
import 'call_api.dart';
import 'call_models.dart';

enum VideoCallCoordinatorState {
  idle,

  // Caller has created/sent the video call request and is waiting
  // for the astrologer to accept.
  ringing,

  preparing,
  joining,
  connected,
  reconnecting,

  // Terminal signalling states before screen cleanup.
  rejected,
  missed,
  busy,

  ending,
  ended,
  failed,
}

class VideoCallCoordinator {
  VideoCallCoordinator({CallApi? callApi, AgoraVideoService? videoService})
    : _callApi = callApi ?? CallApi(),
      _videoService = videoService ?? AgoraVideoService();

  final CallApi _callApi;
  final AgoraVideoService _videoService;

  VideoCallCoordinatorState _state = VideoCallCoordinatorState.idle;
  CallRtcCredentials? _credentials;
  String? _callId;
  String? _errorMessage;
  int? _localUid;
  int? _remoteUid;

  VoidCallback? onChanged;

  VideoCallCoordinatorState get state => _state;
  CallRtcCredentials? get credentials => _credentials;
  String? get callId => _callId;
  String? get errorMessage => _errorMessage;
  int? get localUid => _localUid;
  int? get remoteUid => _remoteUid;

  RtcEngine? get engine => _videoService.engine;

  bool get isConnected => _state == VideoCallCoordinatorState.connected;
  bool get isMuted => _videoService.isMuted;
  bool get isCameraEnabled => _videoService.isCameraEnabled;
  bool get isSpeakerEnabled => _videoService.isSpeakerEnabled;

  Future<void> connect(String callId) async {
    final normalizedCallId = callId.trim();

    if (normalizedCallId.isEmpty) {
      throw const CallApiException(
        'Consultation ID is required for video calling.',
        code: 'INVALID_CALL_ID',
      );
    }

    _callId = normalizedCallId;
    _errorMessage = null;
    _localUid = null;
    _remoteUid = null;

    _setState(VideoCallCoordinatorState.preparing);

    try {
      debugPrint('VIDEO_RTC_TOKEN_REQUEST callId=$normalizedCallId');

      final rtc = await _callApi.generateRtcToken(normalizedCallId);

      debugPrint(
        'VIDEO_RTC_TOKEN_OK '
        'appIdLength=${rtc.appId.length} '
        'tokenLength=${rtc.token.length} '
        'channel=${rtc.channelName} '
        'uid=${rtc.uid}',
      );
      _credentials = rtc;

      _bindRtcCallbacks();

      if (!_videoService.isInitialized) {
        debugPrint('VIDEO_RTC_ENGINE_INIT_START');

        await _videoService.initialize(appId: rtc.appId);

        debugPrint('VIDEO_RTC_ENGINE_INIT_OK');
      }

      _setState(VideoCallCoordinatorState.joining);

      debugPrint(
        'VIDEO_RTC_JOIN_START channel=${rtc.channelName} uid=${rtc.uid}',
      );

      await _videoService.join(
        token: rtc.token,
        channelName: rtc.channelName,
        uid: rtc.uid,
      );

      debugPrint('VIDEO_RTC_JOIN_REQUEST_SENT');
    } catch (error, stackTrace) {
      debugPrint('VIDEO_RTC_CONNECT_FAILED: $error');
      debugPrintStack(label: 'VIDEO_RTC_CONNECT_STACK', stackTrace: stackTrace);
      _errorMessage = error.toString();
      _setState(VideoCallCoordinatorState.failed);
      rethrow;
    }
  }

  void _bindRtcCallbacks() {
    _videoService.onLocalJoined = (uid) {
      debugPrint('VIDEO_RTC_LOCAL_JOINED uid=$uid');
      _localUid = uid;
      _setState(VideoCallCoordinatorState.connected);
    };

    _videoService.onRemoteJoined = (uid) {
      debugPrint('VIDEO_RTC_REMOTE_JOINED uid=$uid');
      _remoteUid = uid;
      _notify();
    };

    _videoService.onRemoteLeft = (uid) {
      if (_remoteUid == uid) {
        _remoteUid = null;
      }

      _notify();
    };

    _videoService.onConnectionStateChanged = (state, reason) {
      final stateText = state.toString().toLowerCase();

      if (stateText.contains('reconnecting')) {
        _setState(VideoCallCoordinatorState.reconnecting);
        return;
      }

      if (stateText.contains('connected') && _videoService.isJoined) {
        _setState(VideoCallCoordinatorState.connected);
      }
    };

    _videoService.onTokenWillExpire = () {
      _renewRtcToken();
    };

    _videoService.onError = (message) {
      debugPrint('VIDEO_RTC_AGORA_ERROR: $message');
      _errorMessage = message;
      _notify();
    };
  }

  Future<void> _renewRtcToken() async {
    final currentCallId = _callId;

    if (currentCallId == null || currentCallId.isEmpty) {
      return;
    }

    try {
      final refreshed = await _callApi.generateRtcToken(currentCallId);

      _credentials = refreshed;

      await _videoService.renewToken(refreshed.token);

      _notify();
    } catch (error) {
      _errorMessage = 'Unable to renew video call token: $error';
      _notify();
    }
  }

  Future<void> setMuted(bool muted) async {
    await _videoService.setMuted(muted);
    _notify();
  }

  Future<void> setCameraEnabled(bool enabled) async {
    await _videoService.setCameraEnabled(enabled);
    _notify();
  }

  Future<void> switchCamera() async {
    await _videoService.switchCamera();
    _notify();
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    await _videoService.setSpeakerEnabled(enabled);
    _notify();
  }

  Future<CurrentCallSession?> extend(int minutes) async {
    final currentCallId = _callId?.trim() ?? '';

    if (currentCallId.isEmpty) {
      throw const CallApiException(
        'No active video consultation was found.',
        code: 'INVALID_CALL_ID',
      );
    }

    final session = await _callApi.extendCall(currentCallId, minutes: minutes);

    _notify();

    return session;
  }

  Future<CurrentCallSession?> refreshCurrentCall() {
    return _callApi.getCurrentCall();
  }

  Future<void> end({String reason = 'USER_ENDED'}) async {
    final currentCallId = _callId;

    if (_state == VideoCallCoordinatorState.ending ||
        _state == VideoCallCoordinatorState.ended) {
      return;
    }

    _setState(VideoCallCoordinatorState.ending);

    debugPrint(
      'VIDEO_CALL_END_START callId=${currentCallId ?? ''} reason=$reason',
    );

    Object? backendError;

    // Local camera/microphone must always be released immediately.
    try {
      await _videoService.leave();
      debugPrint('VIDEO_RTC_LEAVE_OK');
    } catch (error) {
      debugPrint('VIDEO_RTC_LEAVE_WARNING: $error');
    }

    if (currentCallId != null && currentCallId.isNotEmpty) {
      try {
        await _callApi
            .endCall(currentCallId, reason: reason)
            .timeout(const Duration(seconds: 5));

        debugPrint('VIDEO_BACKEND_END_OK callId=$currentCallId');
      } catch (error) {
        backendError = error;

        // A backend/network problem must never trap the user inside
        // an already-disconnected video screen.
        debugPrint(
          'VIDEO_BACKEND_END_WARNING callId=$currentCallId error=$error',
        );
      }
    }

    _localUid = null;
    _remoteUid = null;

    if (backendError != null) {
      _errorMessage = backendError.toString();
    }

    _setState(VideoCallCoordinatorState.ended);

    debugPrint('VIDEO_CALL_END_COMPLETE');
  }

  Future<void> leaveRtcOnly() async {
    debugPrint('VIDEO_RTC_REMOTE_END_CLEANUP_START');

    try {
      await _videoService.leave();
    } catch (error) {
      debugPrint('VIDEO_RTC_REMOTE_END_CLEANUP_WARNING: $error');
    }

    _localUid = null;
    _remoteUid = null;

    _setState(VideoCallCoordinatorState.ended);

    debugPrint('VIDEO_RTC_REMOTE_END_CLEANUP_COMPLETE');
  }

  Future<void> dispose() async {
    await _videoService.dispose();
    _callApi.close();

    onChanged = null;
    _localUid = null;
    _remoteUid = null;
    _credentials = null;
    _callId = null;
  }

  void _setState(VideoCallCoordinatorState value) {
    _state = value;
    _notify();
  }

  void _notify() {
    onChanged?.call();
  }
}

