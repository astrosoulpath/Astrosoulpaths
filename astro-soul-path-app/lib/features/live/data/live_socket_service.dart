import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class LiveSocketService {
  LiveSocketService({
    AuthSessionStore? sessionStore,
    io.Socket Function(String, Map<String, dynamic>)? socketFactory,
  }) : _sessionStore = sessionStore ?? AuthSessionStore(),
       _socketFactory = socketFactory ?? io.io;

  final AuthSessionStore _sessionStore;
  final io.Socket Function(String, Map<String, dynamic>) _socketFactory;
  int _generation = 0;
  bool _joined = false;

  io.Socket? _socket;
  String? _liveSessionId;

  void Function(Map<String, dynamic> message)? onMessage;
  void Function(String message)? onError;
  void Function()? onConnected;
  void Function()? onJoined;
  void Function()? onDisconnected;

  Future<void> connect(String liveSessionId) async {
    final normalized = liveSessionId.trim();

    if (normalized.isEmpty) {
      throw StateError('Live session ID is required.');
    }

    await dispose();
    final generation = _generation;
    final session = await _sessionStore.read();
    if (generation != _generation) return;
    final token = session?.accessToken.trim() ?? '';
    final userId = session?.user['id']?.toString().trim() ?? '';

    if (token.isEmpty || userId.isEmpty) {
      throw StateError('Please sign in before using live chat.');
    }

    _liveSessionId = normalized;

    final baseUri = Uri.parse(ApiConfig.baseUrl);

    final socketBaseUrl = baseUri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/$'), '');

    final socket = _socketFactory(
      '$socketBaseUrl/live-chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableForceNew()
          .enableReconnection()
          .setAuthFn((callback) async {
            try {
              // Re-read/refresh for every handshake, including reconnects.
              final current = await _sessionStore.read();
              if (generation != _generation) return;
              final currentToken = current?.accessToken.trim() ?? '';
              if (currentToken.isEmpty ||
                  current?.user['id']?.toString().trim() != userId ||
                  current?.authProvider != session?.authProvider) {
                await dispose();
                onDisconnected?.call();
                onError?.call('Please sign in again to use live chat.');
                return;
              }
              callback({'token': currentToken});
            } catch (_) {
              if (generation != _generation) return;
              await dispose();
              onDisconnected?.call();
              onError?.call('Unable to restore live chat authentication.');
            }
          })
          .build(),
    );

    _socket = socket;

    // Transport connection alone does not mean server authentication finished.
    socket.on('live:connected', (_) {
      if (generation != _generation || !socket.connected) return;
      debugPrint('LIVE_CHAT_CONNECTED session=$normalized');
      onConnected?.call();

      socket.emit('live:join', {'liveSessionId': normalized});
    });

    socket.on('live:joined', (data) {
      if (generation != _generation || !socket.connected) return;
      _joined = true;
      debugPrint('LIVE_CHAT_JOINED');
      onJoined?.call();
    });

    socket.on('live:message', (data) {
      debugPrint('LIVE_CHAT_MESSAGE');
      if (data is Map) {
        onMessage?.call(Map<String, dynamic>.from(data));
      }
    });

    socket.on('live:error', (data) {
      _joined = false;
      onDisconnected?.call();
      debugPrint('LIVE_CHAT_ERROR');
      if (data is Map) {
        final message = data['message']?.toString().trim();

        if (message != null && message.isNotEmpty) {
          onError?.call(message);
          return;
        }
      }

      onError?.call('Live chat request failed.');
    });

    socket.onConnectError((error) {
      debugPrint('LIVE_CHAT_CONNECT_ERROR');
      onError?.call('Live chat connection failed. Please reconnect.');
    });

    socket.onError((error) {
      onError?.call('Live chat connection error.');
    });

    socket.onDisconnect((_) {
      _joined = false;
      onDisconnected?.call();
    });
    socket.connect();
  }

  void sendMessage(String rawMessage) {
    final message = rawMessage.trim();
    final liveSessionId = _liveSessionId;
    final socket = _socket;

    if (message.isEmpty ||
        liveSessionId == null ||
        socket == null ||
        !socket.connected ||
        !_joined) {
      return;
    }

    socket.emit('live:message', {
      'liveSessionId': liveSessionId,
      'message': message,
    });
  }

  Future<void> dispose() async {
    _generation++;
    _joined = false;
    final socket = _socket;

    _socket = null;
    _liveSessionId = null;

    if (socket != null) {
      socket.clearListeners();
      socket.disconnect();
      socket.dispose();
    }
  }
}
