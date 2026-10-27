import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../../core/config/api_config.dart';
import 'live_socket_service.dart';
import 'live_v2_api.dart';

class LiveV2SocketService extends LiveSocketService {
  LiveV2SocketService(
    this.api, {
    io.Socket Function(String, Map<String, dynamic>)? socketFactory,
    this.ackTimeout = const Duration(seconds: 10),
  }) : _factory = socketFactory ?? io.io;
  final LiveV2Api api;
  final Duration ackTimeout;
  final io.Socket Function(String, Map<String, dynamic>) _factory;
  io.Socket? _socket;
  int _epoch = 0;
  bool _joined = false;
  bool _refresh = false;
  Future<void>? _connecting;
  Future<void>? _accepting;
  Completer<void>? _ack;
  Future<void> Function()? onBound;
  Future<void> Function(Map<String, dynamic>)? onEnded;
  bool get isBound => _joined && (_socket?.connected ?? false);

  @override
  Future<void> connect(String liveSessionId) {
    if (_connecting != null) return _connecting!;
    final task = _connect(liveSessionId);
    _connecting = task;
    return task.whenComplete(() => _connecting = null);
  }

  Future<void> _connect(String id) async {
    if (id != api.sessionId || id.isEmpty) {
      throw StateError('Live session mismatch.');
    }
    _closeTransport();
    final epoch = ++_epoch;
    final ack = Completer<void>();
    _ack = ack;
    final uri = Uri.parse(ApiConfig.baseUrl);
    final base = uri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/$'), '');
    final socket = _factory(
      '$base/live-v2',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setAuthFn((callback) async {
            try {
              final auth = await api.prepareBind(refresh: _refresh);
              _refresh = false;
              if (epoch != _epoch) return;
              callback(auth);
            } catch (_) {
              if (epoch == _epoch) _fail();
            }
          })
          .build(),
    );
    _socket = socket;
    Future<void> accept(dynamic raw) async {
      if (epoch != _epoch || _joined || !socket.connected) return;
      if (_accepting != null) return _accepting;
      final task = () async {
        try {
          if (raw is! Map) throw StateError('Invalid Live acknowledgement.');
          await api.acknowledge(Map<String, dynamic>.from(raw));
          if (epoch != _epoch || !socket.connected) return;
          _joined = true;
          onConnected?.call();
          onJoined?.call();
          if (!ack.isCompleted) ack.complete();
          await onBound?.call();
        } catch (_) {
          if (epoch == _epoch) _fail();
        }
      }();
      _accepting = task;
      try {
        await task;
      } finally {
        if (identical(_accepting, task)) _accepting = null;
      }
    }

    socket.on('live:connected', (data) => unawaited(accept(data)));
    socket.on('live:joined', (data) => unawaited(accept(data)));
    socket.on('live:message', (data) {
      if (epoch == _epoch && isBound && data is Map) {
        onMessage?.call(Map<String, dynamic>.from(data));
      }
    });
    socket.on('live:ended', (data) {
      if (epoch != _epoch ||
          data is! Map ||
          data['sessionId'] != api.sessionId ||
          data['status'] != 'ENDED' ||
          DateTime.tryParse('${data['endedAt']}') == null) {
        return;
      }
      _joined = false;
      onDisconnected?.call();
      final callback = onEnded;
      if (callback != null) {
        unawaited(
          callback(Map<String, dynamic>.from(data)).catchError((Object _) {
            onError?.call('Unable to finish Live cleanup.');
          }),
        );
      }
    });
    socket.on('live:auth-required', (_) {
      if (epoch != _epoch) return;
      _joined = false;
      onDisconnected?.call();
      unawaited(
        reconnect(refresh: true).catchError((Object _) {
          onError?.call('Sign in again to reconnect Live.');
        }),
      );
    });
    socket.on('live:error', (_) {
      if (epoch == _epoch) _fail();
    });
    socket.onConnectError((_) {
      if (epoch == _epoch) _fail();
    });
    socket.onDisconnect((_) {
      if (epoch == _epoch) {
        _joined = false;
        onDisconnected?.call();
      }
    });
    socket.connect();
    try {
      await ack.future.timeout(ackTimeout);
    } catch (_) {
      if (epoch == _epoch) _closeTransport();
      rethrow;
    }
  }

  Future<void> reconnect({bool refresh = false}) {
    _refresh = _refresh || refresh;
    return connect(api.sessionId);
  }

  void _fail() {
    _joined = false;
    onDisconnected?.call();
    onError?.call('Live connection failed. Reconnect to continue.');
    final ack = _ack;
    if (ack != null && !ack.isCompleted) {
      ack.completeError(StateError('Live binding failed.'));
    }
    _closeTransport();
  }

  @override
  void sendMessage(String rawMessage) {
    final message = rawMessage.trim();
    if (!isBound || message.isEmpty || message.length > 500) return;
    _socket!.emit('live:message', {'message': message});
  }

  void _closeTransport() {
    _joined = false;
    _accepting = null;
    final socket = _socket;
    _socket = null;
    socket?.clearListeners();
    socket?.disconnect();
    socket?.dispose();
  }

  @override
  Future<void> dispose() async {
    ++_epoch;
    _closeTransport();
    onDisconnected?.call();
    final ack = _ack;
    if (ack != null && !ack.isCompleted) {
      ack.completeError(StateError('Live socket closed.'));
    }
  }
}
