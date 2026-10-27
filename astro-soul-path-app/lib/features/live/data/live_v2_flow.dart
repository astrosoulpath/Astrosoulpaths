import 'dart:async';
import 'package:flutter/widgets.dart';
import 'live_api.dart';
import 'live_models.dart';
import 'live_rtc_service.dart';
import 'live_v2_api.dart';
import 'live_v2_socket_service.dart';

class LiveV2Flow {
  LiveV2Flow({
    required this.host,
    required this.rtc,
    LiveV2Api? api,
    LiveV2SocketService? socket,
    Timer Function(Duration, void Function(Timer))? timerFactory,
  }) : api = api ?? LiveV2Api(),
       _timerFactory = timerFactory ?? Timer.periodic {
    chat = socket ?? LiveV2SocketService(this.api);
    chat.onBound = _bound;
    chat.onEnded = (data) => authoritativeEnd(data);
  }
  final bool host;
  final LiveRtcService rtc;
  final LiveV2Api api;
  final Timer Function(Duration, void Function(Timer)) _timerFactory;
  late final LiveV2SocketService chat;
  LiveSession? session;
  bool ended = false;
  bool get ready => !ended && rtc.isConnected && chat.isBound;
  bool _disposed = false;
  bool _paused = false;
  Future<LiveJoinResult>? _opening;
  Future<String?>? _renewing;
  Future<void>? _recovering;
  bool _ticking = false;
  bool _hostAvailable = false;
  Timer? _heartbeat;
  Future<void> _lifecycleQueue = Future.value();
  void Function(LiveSession)? onSession;
  void Function(String)? onError;

  Future<LiveJoinResult> open({String? id, String? title}) {
    if (_opening != null) return _opening!;
    final task = _open(id: id, title: title);
    _opening = task;
    return task.catchError((Object error, StackTrace stack) {
      if (identical(_opening, task)) _opening = null;
      Error.throwWithStackTrace(error, stack);
    });
  }

  Future<LiveJoinResult> _open({String? id, String? title}) async {
    if (host) await rtc.ensureHostPermissions();
    if (_disposed) throw StateError('Live closed.');
    final result = await api.open(host: host, id: id, title: title);
    session = result.session;
    if (_disposed) throw StateError('Live closed.');
    onSession?.call(result.session);
    if (_paused) return result;
    await rtc.connect(
      credentials: result.rtc,
      role: host ? LiveRtcRole.broadcaster : LiveRtcRole.audience,
    );
    if (_disposed) {
      await rtc.leave();
      throw StateError('Live closed.');
    }
    try {
      await chat.connect(result.session.id);
    } catch (_) {
      await _stopRtc();
      rethrow;
    }
    return result;
  }

  Future<void> _bound() async {
    if (_disposed || _paused || ended) return;
    _heartbeat?.cancel();
    _heartbeat = _timerFactory(
      const Duration(seconds: 15),
      (_) => unawaited(tick()),
    );
    try {
      await refreshStatus();
    } catch (_) {
      onError?.call('Unable to refresh Live status.');
    }
  }

  Future<void> refreshStatus() async {
    if (_disposed || ended || !api.hasConnection) return;
    final status = await api.status();
    if (_disposed) return;
    if (status['sessionId'] != api.sessionId) {
      throw StateError('Live status session mismatch.');
    }
    if (status['status'] == 'ENDED') {
      await authoritativeEnd(status);
      return;
    }
    if (status['status'] != 'LIVE' || status['hostLeaseValid'] != true) {
      _hostAvailable = false;
      _heartbeat?.cancel();
      await _stopRtc();
      onError?.call(
        'The host connection is unavailable. Waiting for server status.',
      );
      return;
    }
    _hostAvailable = true;
    final count = status['viewerCount'];
    if (count is! int || count < 0) {
      throw StateError('Invalid Live viewer count.');
    }
    final current = session;
    if (current != null) {
      session = current.withStatus(viewerCount: count);
      onSession?.call(session!);
    }
  }

  Future<void> tick() async {
    if (_disposed || _paused || ended || _ticking) return;
    _ticking = true;
    try {
      if (chat.isBound) await api.heartbeat();
      await refreshStatus();
    } catch (error) {
      // A missed ended event must still be discoverable when heartbeat fails
      // or the transport is disconnected. Never infer ENDED from an error.
      try {
        await refreshStatus();
      } catch (_) {}
      if (!ended &&
          error is LiveApiException &&
          [401, 403, 409, 410].contains(error.statusCode)) {
        _heartbeat?.cancel();
        await chat.dispose();
        await _stopRtc();
      }
      if (!ended) {
        onError?.call('Live connection interrupted. Reconnect to continue.');
      }
    } finally {
      _ticking = false;
    }
  }

  Future<String?> renewToken() {
    if (_renewing != null) return _renewing!;
    final task = () async {
      if (_disposed || ended || _paused) return null;
      if (!chat.isBound) await chat.reconnect();
      if (_disposed || ended) return null;
      return (await api.renew()).token;
    }();
    _renewing = task;
    return task.whenComplete(() => _renewing = null);
  }

  Future<void> lifecycle(AppLifecycleState state) {
    final task = _lifecycleQueue.then((_) => _lifecycle(state));
    _lifecycleQueue = task.catchError((Object _) {});
    return task;
  }

  Future<void> _lifecycle(AppLifecycleState state) async {
    if (_disposed || ended) return;
    if (state == AppLifecycleState.resumed) {
      _paused = false;
      await recover();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached ||
        state == AppLifecycleState.hidden) {
      _paused = true;
      _heartbeat?.cancel();
      await chat.dispose();
      // Stop active capture/playback; foreground recovery reuses the same engine.
      await _stopRtc();
    }
  }

  Future<void> recover() {
    if (_recovering != null) return _recovering!;
    final task = () async {
      if (_disposed || ended || !api.hasConnection) return;
      await refreshStatus();
      if (_disposed || ended || !_hostAvailable) return;
      await chat.reconnect(refresh: true);
      if (_disposed || ended) return;
      final rtcProof = await api.renew();
      // leave() retains the engine. Rejoin with its original UID, never create
      // another engine for a foreground recovery.
      if (rtc.engine == null) {
        await rtc.connect(
          credentials: rtcProof,
          role: host ? LiveRtcRole.broadcaster : LiveRtcRole.audience,
        );
      } else {
        await rtc.rejoin(rtcProof);
      }
    }();
    _recovering = task;
    return task.whenComplete(() => _recovering = null);
  }

  Future<void> _stopRtc() async {
    try {
      await rtc.leave();
    } catch (_) {
      try {
        await rtc.dispose();
      } catch (_) {}
      onError?.call('Live media cleanup failed.');
    }
  }

  Future<void> authoritativeEnd(Map<String, dynamic> data) async {
    if (_disposed ||
        ended ||
        data['sessionId'] != api.sessionId ||
        data['status'] != 'ENDED') {
      return;
    }
    final at = DateTime.tryParse('${data['endedAt']}');
    if (at == null) throw StateError('Invalid ended state.');
    ended = true;
    _heartbeat?.cancel();
    await chat.dispose();
    await _stopRtc();
    if (session != null) {
      session = session!.withStatus(
        viewerCount: 0,
        status: 'ENDED',
        endedAt: at,
      );
      onSession?.call(session!);
    }
    await api.forgetEnded();
  }

  Future<void> finish() async {
    _heartbeat?.cancel();
    try {
      if (!ended) await api.finish(host: host);
      ended = true;
    } finally {
      await chat.dispose();
      await _stopRtc();
    }
  }

  void dispose() {
    _disposed = true;
    _heartbeat?.cancel();
    unawaited(chat.dispose());
    api.close();
  }
}
