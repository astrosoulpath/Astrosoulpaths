import 'package:flutter/foundation.dart';

import 'agora_audio_service.dart';
import 'call_api.dart';
import 'call_models.dart';

enum CallCoordinatorState {
  idle,
  preparing,
  joining,
  connected,
  reconnecting,
  ending,
  ended,
  failed,
}

class CallCoordinator {
  CallCoordinator({CallApi? callApi, AgoraAudioService? audioService})
    : _callApi = callApi ?? CallApi(),
      _audioService = audioService ?? AgoraAudioService();

  final CallApi _callApi;
  final AgoraAudioService _audioService;

  CallCoordinatorState _state = CallCoordinatorState.idle;
  CallRtcCredentials? _credentials;
  String? _callId;
  String? _errorMessage;
  int? _remoteUid;

  bool _connectInFlight = false;
  bool _tokenRenewalInFlight = false;
  bool _endInFlight = false;
  bool _disposed = false;
  int _connectionGeneration = 0;
  VoidCallback? onChanged;

  CallCoordinatorState get state => _state;
  CallRtcCredentials? get credentials => _credentials;
  String? get callId => _callId;
  String? get errorMessage => _errorMessage;
  int? get remoteUid => _remoteUid;

  bool get isConnected => _state == CallCoordinatorState.connected;
  bool get isMuted => _audioService.isMuted;
  bool get isSpeakerEnabled => _audioService.isSpeakerEnabled;

  Future<void> connect(String callId) async {
    final normalizedCallId = callId.trim();

    if (normalizedCallId.isEmpty) {
      throw const CallApiException(
        'Call session ID is required for audio calling.',
        code: 'INVALID_CALL_ID',
      );
    }

    if (_disposed) {
      throw StateError('Audio call coordinator has already been disposed.');
    }

    /*
     * initState/retry/double-tap must never race two token requests
     * or two native RTC joins.
     */
    if (_connectInFlight) {
      debugPrint(
        'AUDIO_CONNECT_SKIPPED '
        'reason=connect_in_flight '
        'callId=$normalizedCallId',
      );
      return;
    }

    /*
     * The same backend CallSession is already joining/connected.
     */
    if (_callId == normalizedCallId &&
        (_state == CallCoordinatorState.joining ||
            _state == CallCoordinatorState.connected ||
            _state == CallCoordinatorState.reconnecting)) {
      debugPrint(
        'AUDIO_CONNECT_SKIPPED '
        'reason=already_active '
        'callId=$normalizedCallId '
        'state=$_state',
      );
      return;
    }

    _connectInFlight = true;

    final generation = ++_connectionGeneration;

    _callId = normalizedCallId;
    _remoteUid = null;
    _credentials = null;
    _errorMessage = null;

    _setState(CallCoordinatorState.preparing);

    try {
      final rtc = await _callApi.generateRtcToken(normalizedCallId);

      /*
       * This async response may belong to an old connect attempt.
       */
      if (_disposed || generation != _connectionGeneration) {
        return;
      }

      final rtcCallId = rtc.callId.trim();

      if (rtcCallId.isNotEmpty && rtcCallId != normalizedCallId) {
        throw const CallApiException(
          'The calling server returned credentials for another call.',
          code: 'RTC_CALL_MISMATCH',
        );
      }

      if (rtc.appId.trim().isEmpty ||
          rtc.token.trim().isEmpty ||
          rtc.channelName.trim().isEmpty ||
          rtc.uid <= 0) {
        throw const CallApiException(
          'The calling server returned invalid RTC credentials.',
          code: 'INVALID_RTC_RESPONSE',
        );
      }

      _credentials = rtc;

      _bindRtcCallbacks(generation);

      if (!_audioService.isInitialized) {
        await _audioService.initialize(appId: rtc.appId);
      }

      if (_disposed || generation != _connectionGeneration) {
        return;
      }

      _setState(CallCoordinatorState.joining);

      await _audioService.join(
        token: rtc.token,
        channelName: rtc.channelName,
        uid: rtc.uid,
      );
    } catch (error) {
      if (!_disposed && generation == _connectionGeneration) {
        _errorMessage = error.toString();

        _setState(CallCoordinatorState.failed);
      }

      rethrow;
    } finally {
      if (generation == _connectionGeneration) {
        _connectInFlight = false;
      }
    }
  }

  void _bindRtcCallbacks(int generation) {
    bool isCurrentGeneration() {
      return !_disposed && generation == _connectionGeneration;
    }

    _audioService.onLocalJoined = (_) {
      if (!isCurrentGeneration()) {
        return;
      }

      _setState(CallCoordinatorState.connected);
    };

    _audioService.onRemoteJoined = (uid) {
      if (!isCurrentGeneration()) {
        return;
      }

      _remoteUid = uid;

      debugPrint(
        'AUDIO_REMOTE_PARTICIPANT_JOINED '
        'callId=$_callId uid=$uid',
      );

      _notify();
    };

    _audioService.onRemoteLeft = (uid) {
      if (!isCurrentGeneration()) {
        return;
      }

      if (_remoteUid == uid) {
        _remoteUid = null;
      }

      debugPrint(
        'AUDIO_REMOTE_PARTICIPANT_LEFT '
        'callId=$_callId uid=$uid',
      );

      _notify();
    };

    _audioService.onConnectionStateChanged = (state, reason) {
      if (!isCurrentGeneration()) {
        return;
      }

      final stateText = state.toString().toLowerCase();

      debugPrint(
        'AUDIO_RTC_CONNECTION_STATE '
        'callId=$_callId '
        'state=$state '
        'reason=$reason',
      );

      if (stateText.contains('reconnecting')) {
        _setState(CallCoordinatorState.reconnecting);
        return;
      }

      if (stateText.contains('connected') && _audioService.isJoined) {
        _setState(CallCoordinatorState.connected);
      }
    };

    _audioService.onTokenWillExpire = () {
      if (!isCurrentGeneration()) {
        return;
      }

      _renewRtcToken(generation);
    };

    _audioService.onError = (message) {
      if (!isCurrentGeneration()) {
        return;
      }

      _errorMessage = message;

      debugPrint(
        'AUDIO_RTC_ERROR '
        'callId=$_callId '
        'message=$message',
      );

      _notify();
    };
  }

  Future<void> _renewRtcToken(int generation) async {
    final currentCallId = _callId?.trim() ?? '';

    final currentCredentials = _credentials;

    if (_disposed ||
        generation != _connectionGeneration ||
        currentCallId.isEmpty ||
        currentCredentials == null ||
        _tokenRenewalInFlight) {
      return;
    }

    _tokenRenewalInFlight = true;

    try {
      final refreshed = await _callApi.generateRtcToken(currentCallId);

      if (_disposed || generation != _connectionGeneration) {
        return;
      }

      /*
       * Renewal may refresh only the token.
       * It may never silently move the participant into another
       * channel or another Agora UID.
       */
      if (refreshed.channelName.trim() !=
              currentCredentials.channelName.trim() ||
          refreshed.uid != currentCredentials.uid) {
        throw const CallApiException(
          'The calling server returned inconsistent renewed RTC credentials.',
          code: 'RTC_RENEWAL_MISMATCH',
        );
      }

      final refreshedCallId = refreshed.callId.trim();

      if (refreshedCallId.isNotEmpty && refreshedCallId != currentCallId) {
        throw const CallApiException(
          'The renewed RTC token belongs to another call.',
          code: 'RTC_CALL_MISMATCH',
        );
      }

      if (refreshed.token.trim().isEmpty) {
        throw const CallApiException(
          'The calling server returned an empty renewed RTC token.',
          code: 'INVALID_RTC_RESPONSE',
        );
      }

      /*
       * Renew native token first. Only after the engine accepts
       * it do we promote refreshed credentials to current state.
       */
      await _audioService.renewToken(refreshed.token);

      if (_disposed || generation != _connectionGeneration) {
        return;
      }

      _credentials = refreshed;
      _errorMessage = null;

      debugPrint(
        'AUDIO_RTC_TOKEN_RENEWED '
        'callId=$currentCallId '
        'channel=${refreshed.channelName} '
        'uid=${refreshed.uid}',
      );

      _notify();
    } catch (error) {
      if (!_disposed && generation == _connectionGeneration) {
        _errorMessage = 'Unable to renew call token: $error';

        debugPrint(
          'AUDIO_RTC_TOKEN_RENEW_FAILED '
          'callId=$currentCallId '
          'error=$error',
        );

        _notify();
      }
    } finally {
      _tokenRenewalInFlight = false;
    }
  }

  Future<void> setMuted(bool muted) async {
    if (_disposed ||
        _state == CallCoordinatorState.ending ||
        _state == CallCoordinatorState.ended) {
      throw StateError(
        'Cannot change microphone state after the call has ended.',
      );
    }
    await _audioService.setMuted(muted);
    _notify();
  }

  Future<void> setSpeakerEnabled(bool enabled) async {
    if (_disposed ||
        _state == CallCoordinatorState.ending ||
        _state == CallCoordinatorState.ended) {
      throw StateError('Cannot change speaker state after the call has ended.');
    }
    await _audioService.setSpeakerEnabled(enabled);
    _notify();
  }

  Future<void> end({String reason = 'USER_ENDED'}) async {
    if (_disposed) {
      return;
    }

    if (_endInFlight) {
      debugPrint('AUDIO_END_SKIPPED reason=end_in_flight callId=$_callId');
      return;
    }

    if (_state == CallCoordinatorState.ended) {
      await _audioService.leave();
      return;
    }

    final currentCallId = _callId?.trim() ?? '';

    _endInFlight = true;

    _connectionGeneration++;
    _tokenRenewalInFlight = false;

    _setState(CallCoordinatorState.ending);

    try {
      if (currentCallId.isNotEmpty) {
        await _callApi.endCall(currentCallId, reason: reason);
      }

      await _audioService.leave();

      _remoteUid = null;
      _credentials = null;
      _errorMessage = null;

      _setState(CallCoordinatorState.ended);

      debugPrint(
        'AUDIO_CALL_END_COMMITTED '
        'callId=$currentCallId '
        'reason=$reason',
      );
    } catch (error) {
      _errorMessage = 'Unable to end call safely: $error';

      if (!_disposed && _audioService.isJoined) {
        _setState(
          _remoteUid == null
              ? CallCoordinatorState.reconnecting
              : CallCoordinatorState.connected,
        );
      } else if (!_disposed) {
        _setState(CallCoordinatorState.failed);
      }

      debugPrint(
        'AUDIO_CALL_END_FAILED '
        'callId=$currentCallId '
        'reason=$reason '
        'error=$error',
      );

      rethrow;
    } finally {
      _endInFlight = false;
    }
  }

  Future<CurrentCallSession?> extend(int minutes) async {
    if (_disposed) {
      throw StateError('Audio call coordinator has already been disposed.');
    }

    if (_endInFlight ||
        _state == CallCoordinatorState.ending ||
        _state == CallCoordinatorState.ended) {
      throw StateError(
        'Cannot extend a call while it is ending or already ended.',
      );
    }
    final currentCallId = _callId?.trim() ?? '';

    if (currentCallId.isEmpty) {
      throw const CallApiException(
        'No active audio consultation was found.',
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

  Future<void> dispose() async {
    if (_disposed) {
      return;
    }

    /*
     * Invalidate every outstanding connect/token callback before
     * releasing native RTC resources.
     */
    _disposed = true;
    _connectionGeneration++;

    _connectInFlight = false;
    _tokenRenewalInFlight = false;
    _endInFlight = false;

    _audioService.onLocalJoined = null;
    _audioService.onRemoteJoined = null;
    _audioService.onRemoteLeft = null;
    _audioService.onConnectionStateChanged = null;
    _audioService.onError = null;
    _audioService.onTokenWillExpire = null;

    await _audioService.dispose();

    _callApi.close();

    onChanged = null;
    _remoteUid = null;
    _credentials = null;
    _callId = null;
  }

  void _setState(CallCoordinatorState value) {
    _state = value;
    _notify();
  }

  void _notify() {
    onChanged?.call();
  }
}
