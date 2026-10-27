import 'communication_socket_recovery.dart';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/api_config.dart';

class ChatSocketService {
  io.Socket? socket;
  CommunicationSocketRecovery? _recovery;

  void connect({
    required String token,
    required String chatSessionId,
    String? userId,
    required Function(dynamic) onMessage,
    required Function(dynamic) onTyping,
    required Function(dynamic) onRead,
    Function(dynamic)? onPresence,
    Function(dynamic)? onEnded,
    Function(dynamic)? onExtended,
    void Function(bool connected)? onConnectionChanged,
  }) {
    dispose();

    final apiUri = Uri.parse(ApiConfig.baseUrl);
    final socketUri = apiUri.replace(
      path: '/chat',
      query: null,
      fragment: null,
    );

    debugPrint('[SOCKET_TRACE] TARGET namespace=$socketUri');

    socket = io.io(
      socketUri.toString(),
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token})
          .disableAutoConnect()
          .disableReconnection()
          .enableForceNew()
          .build(),
    );

    socket!.onConnect((_) {
      debugPrint(
        '[SOCKET_TRACE] CONNECTED session=$chatSessionId socket=${socket?.id}',
      );

      debugPrint('[SOCKET_TRACE] JOIN_SENT session=$chatSessionId');
    });

    socket!.on('chat:connected', (_) {
      socket?.emit('chat:join', {'callSessionId': chatSessionId});
    });

    socket!.onDisconnect((reason) {
      debugPrint(
        '[SOCKET_TRACE] DISCONNECTED session=$chatSessionId reason=$reason',
      );
      onConnectionChanged?.call(false);
    });

    socket!.onConnectError((error) {
      debugPrint(
        '[SOCKET_TRACE] CONNECT_ERROR session=$chatSessionId target=$socketUri error=$error',
      );
      onConnectionChanged?.call(false);
    });

    socket!.onError((error) {
      debugPrint(
        '[SOCKET_TRACE] ERROR session=$chatSessionId target=$socketUri error=$error',
      );
      onConnectionChanged?.call(false);
    });

    socket!.on('chat:error', (data) {
      debugPrint(
        '[SOCKET_TRACE] SERVER_CHAT_ERROR session=$chatSessionId data=$data',
      );
    });

    socket!.on('chat:message', onMessage);
    socket!.on('chat:typing', onTyping);
    socket!.on('chat:read', onRead);

    socket!.on('chat:read-all', (data) {
      onRead(data);
    });

    socket!.on('chat:presence', (data) {
      debugPrint(
        '[SOCKET_TRACE] PRESENCE_RECEIVED session=$chatSessionId data=$data',
      );

      onPresence?.call(data);
    });

    // Authoritative presence snapshot returned after joining the room.
    // This complements realtime chat:presence events and prevents a
    // participant who was already in the room from remaining Offline.
    socket!.on('chat:joined', (data) {
      _recovery?.connected();
      onConnectionChanged?.call(true);
      debugPrint(
        '[SOCKET_TRACE] JOINED_RECEIVED session=$chatSessionId data=$data',
      );

      if (onPresence == null || data is! Map) {
        return;
      }

      final rawOnlineUserIds = data['onlineUserIds'];

      if (rawOnlineUserIds is! List) {
        return;
      }

      for (final rawUserId in rawOnlineUserIds) {
        final userId = rawUserId?.toString().trim() ?? '';

        if (userId.isEmpty) {
          continue;
        }

        onPresence.call({
          'callSessionId':
              data['callSessionId']?.toString().trim() ?? chatSessionId,
          'userId': userId,
          'isOnline': true,
        });
      }
    });

    socket!.on('chat:ended', (data) {
      onEnded?.call(data);
    });

    socket!.on('chat:extended', (data) {
      debugPrint('[SOCKET_TRACE] EXTENDED_RECEIVED data=$data');
      onExtended?.call(data);
    });

    final transport = socket!;
    _recovery = CommunicationSocketRecovery(
      initialToken: token,
      expectedUserId: userId,
      applyToken: (value) => transport.auth = {'token': value},
      connect: () {
        transport.connect();
      },
      disconnect: () {
        transport.disconnect();
      },
    );
    transport.on('auth:required', (_) => _recovery?.schedule(force: true));
    transport.onDisconnect((_) => _recovery?.schedule());
    transport.onConnectError((_) => _recovery?.schedule(force: true));

    _recovery!.reconnect();
  }

  void sendMessage({
    required String chatSessionId,
    required String message,
    String? replyToMessageId,
  }) {
    socket?.emit('chat:message', {
      'callSessionId': chatSessionId,
      'message': message,
      if (replyToMessageId?.trim().isNotEmpty == true)
        'replyToMessageId': replyToMessageId!.trim(),
    });
  }

  void sendTyping({required String chatSessionId, required bool typing}) {
    socket?.emit('chat:typing', {
      'callSessionId': chatSessionId,
      'isTyping': typing,
    });
  }

  void dispose() {
    _recovery?.dispose();
    _recovery = null;
    final activeSocket = socket;

    if (activeSocket != null) {
      activeSocket.clearListeners();
      activeSocket.disconnect();
      activeSocket.dispose();
    }

    socket = null;
  }
}
