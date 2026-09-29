import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class LiveSocketService {
  LiveSocketService({AuthSessionStore? sessionStore})
    : _sessionStore = sessionStore ?? AuthSessionStore();

  final AuthSessionStore _sessionStore;

  io.Socket? _socket;
  String? _liveSessionId;

  void Function(Map<String, dynamic> message)? onMessage;
  void Function(String message)? onError;
  void Function()? onConnected;
  void Function()? onJoined;

  Future<void> connect(String liveSessionId) async {
    final normalized = liveSessionId.trim();

    if (normalized.isEmpty) {
      throw StateError('Live session ID is required.');
    }

    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw StateError('Please sign in before using live chat.');
    }

    await dispose();

    _liveSessionId = normalized;

    final baseUri = Uri.parse(ApiConfig.baseUrl);

    final socketBaseUrl = baseUri
        .replace(path: '', query: null, fragment: null)
        .toString()
        .replaceFirst(RegExp(r'/$'), '');

    final socket = io.io(
      '$socketBaseUrl/live-chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .enableReconnection()
          .setAuth({'token': token})
          .build(),
    );

    _socket = socket;

    socket.onConnect((_) {
      debugPrint('LIVE_CHAT_CONNECTED session=$normalized');
      onConnected?.call();

      socket.emit('live:join', {'liveSessionId': normalized});
    });

    socket.on('live:joined', (data) {
      debugPrint('LIVE_CHAT_JOINED session=$normalized data=$data');
      onJoined?.call();
    });

    socket.on('live:message', (data) {
      debugPrint('LIVE_CHAT_MESSAGE session=$normalized data=$data');
      if (data is Map) {
        onMessage?.call(Map<String, dynamic>.from(data));
      }
    });

    socket.on('live:error', (data) {
      debugPrint('LIVE_CHAT_ERROR session=$normalized data=$data');
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
      debugPrint('LIVE_CHAT_CONNECT_ERROR session=$normalized error=$error');
      onError?.call('Live chat connection failed: $error');
    });

    socket.onError((error) {
      onError?.call('Live chat error: $error');
    });

    socket.connect();
  }

  void sendMessage(String rawMessage) {
    final message = rawMessage.trim();
    final liveSessionId = _liveSessionId;
    final socket = _socket;

    if (message.isEmpty || liveSessionId == null || socket == null) {
      return;
    }

    socket.emit('live:message', {
      'liveSessionId': liveSessionId,
      'message': message,
    });
  }

  Future<void> dispose() async {
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
