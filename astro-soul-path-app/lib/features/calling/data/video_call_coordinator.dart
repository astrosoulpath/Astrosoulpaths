import 'dart:async';
import '../../auth/data/auth_session_store.dart';
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
  VideoCallCoordinator({
    CallApi? callApi,
    AgoraVideoService? videoService,
    Future<String?> Function()? readUserId,
  }) : _callApi = callApi ?? CallApi(),
       _videoService = videoService ?? AgoraVideoService(),
       _readUserId =
           readUserId ??
           (() async {
             final session = await AuthSessionStore().read();
             return (session?.user['id'] ?? session?.user['userId'])
                 ?.toString();
           });

  final Future<String?> Function() _readUserId;
  String? _userId;
  bool _disposed = false;
  bool _connectInFlight = false;
  bool _tokenRenewalInFlight = false;
  int _generation = 0;
  bool _current(int generation) => !_disposed && generation == _generation;
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
    if (_disposed ||
        _state == VideoCallCoordinatorState.ending ||
        _state == VideoCallCoordinatorState.ended) {
      return;
    }

    if (normalizedCallId.isEmpty) {
      throw const CallApiException(
        'Consultation ID is required for video calling.',
        code: 'INVALID_CALL_ID',
      );
    }

    if (_disposed ||
        _connectInFlight ||
        (_callId == normalizedCallId &&
            [
              VideoCallCoordinatorState.joining,
              VideoCallCoordinatorState.connected,
              VideoCallCoordinatorState.reconnecting,
            ].contains(_state))) {
      return;
    }
    _connectInFlight = true;
    final generation = ++_generation;
    _callId = normalizedCallId;
    _errorMessage = null;
    _localUid = null;
    _remoteUid = null;

    _setState(VideoCallCoordinatorState.preparing);

    try {
      _userId = await _readUserId();
      if (!_current(generation)) return;
      if (_userId == null || _userId!.isEmpty) {
        throw const CallApiException('Please login again.');
      }
      debugPrint('VIDEO_RTC_TOKEN_REQUEST callId=$normalizedCallId');

      final rtc = await _callApi.generateRtcToken(normalizedCallId);

      debugPrint(
        'VIDEO_RTC_TOKEN_OK '
        'appIdLength=${rtc.appId.length} '
        'tokenLength=${rtc.token.length} '
        'channel=${rtc.channelName} '
        'uid=${rtc.uid}',
      );
      if (!_current(generation)) return;
      if (await _readUserId() != _userId) {
        throw const CallApiException(
          'Account changed. Please reopen the call.',
        );
      }
      if (!_current(generation)) return;
      if (rtc.callId.isNotEmpty && rtc.callId != normalizedCallId) {
        throw const CallApiException('Invalid call credentials.');
      }
      _credentials = rtc;

      _bindRtcCallbacks(generation);

      if (!_videoService.isInitialized) {
        debugPrint('VIDEO_RTC_ENGINE_INIT_START');

        await _videoService.initialize(appId: rtc.appId);

        debugPrint('VIDEO_RTC_ENGINE_INIT_OK');
      }

      if (!_current(generation)) {
        await _videoService.dispose();
        return;
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

      if (!_current(generation)) {
        await _videoService.leave();
        return;
      }
      debugPrint('VIDEO_RTC_JOIN_REQUEST_SENT');
    } catch (error, stackTrace) {
      if (!_current(generation)) return;
      debugPrint('VIDEO_RTC_CONNECT_FAILED: $error');
      debugPrintStack(label: 'VIDEO_RTC_CONNECT_STACK', stackTrace: stackTrace);
      _errorMessage = error.toString();
      _setState(VideoCallCoordinatorState.failed);
      rethrow;
    } finally {
      if (_current(generation)) _connectInFlight = false;
    }
  }

  void _bindRtcCallbacks(int generation) {
    _videoService.onLocalJoined = (uid) {
      if (!_current(generation)) return;
      debugPrint('VIDEO_RTC_LOCAL_JOINED uid=$uid');
      _localUid = uid;
      _setState(VideoCallCoordinatorState.connected);
    };

    _videoService.onRemoteJoined = (uid) {
      if (!_current(generation)) return;
      debugPrint('VIDEO_RTC_REMOTE_JOINED uid=$uid');
      _remoteUid = uid;
      _notify();
    };

    _videoService.onRemoteLeft = (uid) {
      if (!_current(generation)) return;
      if (_remoteUid == uid) {
        _remoteUid = null;
      }

      _notify();
    };

    _videoService.onConnectionStateChanged = (state, reason) {
      if (!_current(generation)) return;
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
      unawaited(_renewRtcToken(generation));
    };

    _videoService.onError = (message) {
      if (!_current(generation)) return;
      debugPrint('VIDEO_RTC_AGORA_ERROR: $message');
      _errorMessage = message;
      _notify();
    };
  }

  Future<void> _renewRtcToken(int generation) async {
    final id = _callId;
    final current = _credentials;
    if (!_current(generation) ||
        _tokenRenewalInFlight ||
        id == null ||
        current == null) {
      return;
    }
    _tokenRenewalInFlight = true;
    try {
      final owner = await _readUserId();
      if (!_current(generation)) return;
      if (owner != _userId) {
        await leaveRtcOnly();
        _errorMessage = 'Account changed. Please reopen the call.';
        return;
      }
      if (!_current(generation)) return;
      final refreshed = await _callApi.generateRtcToken(id);
      if (!_current(generation)) return;
      final refreshedOwner = await _readUserId();
      if (!_current(generation)) return;
      if (refreshedOwner != _userId) {
        await leaveRtcOnly();
        _errorMessage = 'Account changed. Please reopen the call.';
        return;
      }
      if (!_current(generation)) return;
      if (refreshed.channelName != current.channelName ||
          refreshed.uid != current.uid ||
          refreshed.appId != current.appId ||
          refreshed.role != current.role ||
          (refreshed.callId.isNotEmpty && refreshed.callId != id) ||
          refreshed.token.isEmpty ||
          (refreshed.callExpiresAt?.isBefore(DateTime.now()) ?? false)) {
        throw const CallApiException('Invalid renewed call credentials.');
      }
      await _videoService.renewToken(refreshed.token);
      if (!_current(generation)) return;
      _credentials = refreshed;
      _errorMessage = null;
      _notify();
    } catch (_) {
      if (_current(generation)) {
        _errorMessage =
            'Unable to renew video call token. Check your connection.';
        _notify();
      }
    } finally {
      if (_current(generation)) _tokenRenewalInFlight = false;
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

    if (_disposed ||
        _state == VideoCallCoordinatorState.ending ||
        _state == VideoCallCoordinatorState.ended) {
      return;
    }

    ++_generation;
    _tokenRenewalInFlight = false;
    _connectInFlight = false;
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
      await _videoService.dispose();
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
    ++_generation;
    _tokenRenewalInFlight = false;
    debugPrint('VIDEO_RTC_REMOTE_END_CLEANUP_START');

    try {
      await _videoService.leave();
    } catch (error) {
      await _videoService.dispose();
    }

    _localUid = null;
    _remoteUid = null;

    _setState(VideoCallCoordinatorState.ended);

    debugPrint('VIDEO_RTC_REMOTE_END_CLEANUP_COMPLETE');
  }

  Future<void> dispose() async {
    if (_disposed) return;
    _disposed = true;
    ++_generation;
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
    if (!_disposed) onChanged?.call();
  }
}
