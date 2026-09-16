import 'package:socket_io_client/socket_io_client.dart' as io;

import '../../../core/config/api_config.dart';

class VideoCallSocketService {
  io.Socket? _socket;

  bool get isConnected => _socket?.connected == true;

  void connect({
    required String userId,
    required String accessToken,
    void Function()? onRegistered,
    void Function(Map<String, dynamic>)? onIncoming,
    void Function(Map<String, dynamic>)? onAccepted,
    void Function(Map<String, dynamic>)? onRejected,
    void Function(Map<String, dynamic>)? onMissed,
    void Function(Map<String, dynamic>)? onCancelled,
    void Function(Map<String, dynamic>)? onUnavailable,
    void Function(Map<String, dynamic>)? onCallError,
  }) {
    dispose();

    final normalizedUserId = userId.trim();
    final normalizedAccessToken = accessToken.trim();

    if (normalizedUserId.isEmpty) {
      throw ArgumentError('Call socket user ID is required.');
    }

    if (normalizedAccessToken.isEmpty) {
      throw ArgumentError('Call socket access token is required.');
    }

    _socket = io.io(
      '${ApiConfig.baseUrl}/call',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth(<String, dynamic>{'token': normalizedAccessToken})
          .disableAutoConnect()
          .enableReconnection()
          .build(),
    );

    final socket = _socket!;

    socket.onConnect((_) {
      socket.emit('call:register', {'userId': normalizedUserId});
    });

    socket.on('call:registered', (_) => onRegistered?.call());
    socket.on('call:incoming', (data) => onIncoming?.call(_map(data)));
    socket.on('call:accepted', (data) => onAccepted?.call(_map(data)));
    socket.on('call:rejected', (data) => onRejected?.call(_map(data)));
    socket.on('call:missed', (data) => onMissed?.call(_map(data)));

    // Different backend/socket versions can use either spelling.
    // Supporting all aliases keeps an expired/cancelled incoming
    // dialog from remaining on the astrologer screen.
    socket.on('call:cancelled', (data) => onCancelled?.call(_map(data)));
    socket.on('call:canceled', (data) => onCancelled?.call(_map(data)));
    socket.on('call:cancel', (data) => onCancelled?.call(_map(data)));

    socket.on('call:unavailable', (data) => onUnavailable?.call(_map(data)));
    socket.on('call:error', (data) => onCallError?.call(_map(data)));

    socket.connect();
  }

  void initiate({
    required String callId,
    required String callerUserId,
    required String recipientUserId,
    required String callerName,
  }) {
    _socket?.emit('call:initiate', {
      'callId': callId.trim(),
      'callerId': callerUserId.trim(),
      'recipientUserId': recipientUserId.trim(),
      'callerName': callerName.trim().isEmpty ? 'Customer' : callerName.trim(),
      'consultationType': 'VIDEO',
    });
  }

  void accept({
    required String callId,
    required String callerUserId,
    required String receiverUserId,
  }) {
    _socket?.emit('call:accept', {
      'callId': callId.trim(),
      'callerUserId': callerUserId.trim(),
      'receiverUserId': receiverUserId.trim(),
    });
  }

  void reject({
    required String callId,
    required String callerUserId,
    required String receiverUserId,
  }) {
    _socket?.emit('call:reject', {
      'callId': callId.trim(),
      'callerUserId': callerUserId.trim(),
      'receiverUserId': receiverUserId.trim(),
      'reason': 'The video call was declined.',
    });
  }

  void cancel({
    required String callId,
    required String callerUserId,
    required String recipientUserId,
  }) {
    _socket?.emit('call:cancel', {
      'callId': callId.trim(),
      'callerUserId': callerUserId.trim(),
      'recipientUserId': recipientUserId.trim(),
      'reason': 'The customer cancelled the video call.',
    });
  }

  void dispose() {
    final socket = _socket;

    if (socket != null) {
      socket.clearListeners();
      socket.disconnect();
      socket.dispose();
    }

    _socket = null;
  }

  static Map<String, dynamic> _map(dynamic source) {
    if (source is Map<String, dynamic>) {
      return source;
    }

    if (source is Map) {
      return Map<String, dynamic>.from(source);
    }

    return <String, dynamic>{};
  }
}
