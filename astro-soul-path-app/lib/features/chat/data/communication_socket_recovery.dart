import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/widgets.dart';
import '../../auth/data/auth_session_store.dart';

/// Refreshes before each connection and fences logout/account-switch races.
class CommunicationSocketRecovery with WidgetsBindingObserver {
  CommunicationSocketRecovery({
    required this.initialToken,
    required this.expectedUserId,
    required this.applyToken,
    required this.connect,
    required this.disconnect,
    Future<StoredAuthSession?> Function(bool force)? readSession,
    double Function()? random,
  }) : _random = random ?? Random().nextDouble,
       _readSession =
           readSession ??
           ((force) {
             final store = AuthSessionStore();
             return force ? store.forceRefresh() : store.read();
           }) {
    WidgetsBinding.instance.addObserver(this);
    _paused =
        WidgetsBinding.instance.lifecycleState == AppLifecycleState.paused;
  }

  final String initialToken;
  final String? expectedUserId;
  final void Function(String) applyToken;
  final void Function() connect;
  final void Function() disconnect;
  final Future<StoredAuthSession?> Function(bool) _readSession;
  final double Function() _random;
  Timer? _timer;
  Timer? _watchdog;
  bool _paused = false;
  bool _stopped = false;
  bool _connected = false;
  int _generation = 0;
  Future<void>? _inFlight;
  bool _disposed = false;
  bool _force = false;
  int _attempts = 0;

  String? _subject(String token) {
    try {
      return (jsonDecode(
                utf8.decode(
                  base64Url.decode(base64Url.normalize(token.split('.')[1])),
                ),
              )
              as Map)['sub']
          as String?;
    } catch (_) {
      return null;
    }
  }

  Future<void> reconnect({bool force = false}) {
    if (_disposed || _stopped || _paused || _connected) return Future.value();
    _force = _force || force;
    final generation = _generation;
    return _inFlight ??= _reconnect().whenComplete(() {
      _inFlight = null;
      if (generation != _generation && !_connected) schedule();
    });
  }

  Future<void> _reconnect() async {
    _timer?.cancel();
    final generation = _generation;
    final force = _force;
    _force = false;
    try {
      final session = await _readSession(force);
      if (_disposed || _stopped || _paused || generation != _generation) return;
      final id =
          session?.user['id']?.toString() ??
          session?.user['userId']?.toString();
      final token = session?.accessToken.trim() ?? '';
      final expected = expectedUserId?.trim() ?? '';
      final sameIdentity = expected.isNotEmpty
          ? id == expected
          : token == initialToken ||
                (_subject(initialToken) != null &&
                    _subject(initialToken) == _subject(token));
      if (session == null || token.isEmpty || !sameIdentity) {
        _stop();
        return;
      }
      // Re-read after asynchronous refresh, so an explicit logout cannot restore this socket.
      final current = await _readSession(false);
      if (_disposed || _stopped || _paused || generation != _generation) return;
      if (current == null ||
          (current.user['id'] ?? current.user['userId']) != id ||
          current.accessToken != token) {
        _stop();
        return;
      }
      applyToken(token);
      connect();
      _watchdog?.cancel();
      _watchdog = Timer(const Duration(seconds: 10), () {
        if (!_connected && !_disposed && !_paused) {
          disconnect();
          schedule();
        }
      });
    } catch (_) {
      if (!_disposed && !_stopped && !_paused) {
        disconnect();
        schedule(force: force);
      }
    }
  }

  void schedule({bool force = false}) {
    _connected = false;
    _force = _force || force;
    if (_disposed || _stopped || _paused || _timer?.isActive == true) return;
    _watchdog?.cancel();
    final base = min(30000, 1000 * (1 << min(_attempts++, 5)));
    final delay = (base * (0.8 + 0.2 * _random().clamp(0.0, 1.0))).round();
    _timer = Timer(Duration(milliseconds: delay), () => unawaited(reconnect()));
  }

  void connected() {
    _connected = true;
    _attempts = 0;
    _timer?.cancel();
    _watchdog?.cancel();
  }

  void _stop() {
    _stopped = true;
    _generation++;
    _timer?.cancel();
    _watchdog?.cancel();
    disconnect();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _paused = false;
      if (!_connected) schedule();
    } else {
      _paused = true;
      _generation++;
      _timer?.cancel();
      _watchdog?.cancel();
    }
  }

  void dispose() {
    _disposed = true;
    _generation++;
    _watchdog?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
  }
}
