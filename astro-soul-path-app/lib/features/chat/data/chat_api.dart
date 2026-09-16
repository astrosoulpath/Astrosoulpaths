import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'chat_models.dart';

class ChatApiException implements Exception {
  const ChatApiException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

class ChatSafetyStatus {
  const ChatSafetyStatus({
    required this.userId,
    required this.blockedByMe,
    required this.blockedMe,
    required this.canMessage,
  });

  factory ChatSafetyStatus.fromJson(Map<String, dynamic> json) {
    return ChatSafetyStatus(
      userId: json['userId']?.toString().trim() ?? '',
      blockedByMe: json['blockedByMe'] == true,
      blockedMe: json['blockedMe'] == true,
      canMessage: json['canMessage'] != false,
    );
  }

  final String userId;
  final bool blockedByMe;
  final bool blockedMe;
  final bool canMessage;
}

class ChatApi {
  ChatApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<ChatRoom> joinChat(String callSessionId) async {
    final normalizedId = _normalizeId(callSessionId);

    final body = await _request(
      path: '/chat/join',
      method: 'POST',
      payload: {'callSessionId': normalizedId},
    );

    final data = _readData(body);
    final room = ChatRoom.fromJson(data);

    if (room.roomId.isEmpty) {
      throw const ChatApiException('The server returned an invalid chat room.');
    }

    return room;
  }

  Future<ChatHistory> getChatHistory(String callSessionId) async {
    final normalizedId = _normalizeId(callSessionId);

    final body = await _request(
      path: '/chat/${Uri.encodeComponent(normalizedId)}/history',
      method: 'GET',
    );

    final data = _readData(body);
    final rawMessages = data['messages'];
    final messages = <ChatMessage>[];

    if (rawMessages is List) {
      for (final item in rawMessages) {
        if (item is Map) {
          final message = ChatMessage.fromJson(Map<String, dynamic>.from(item));

          if (message.id.isNotEmpty) {
            messages.add(message);
          }
        }
      }
    }

    messages.sort((first, second) {
      final firstDate =
          first.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final secondDate =
          second.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);

      return firstDate.compareTo(secondDate);
    });

    return ChatHistory(
      messages: List.unmodifiable(messages),
      total: int.tryParse(data['total']?.toString() ?? '') ?? messages.length,
      unreadCount: int.tryParse(data['unreadCount']?.toString() ?? '') ?? 0,
    );
  }

  Future<void> registerE2eeDevice({
    required String deviceId,
    required String publicKey,
    int keyVersion = 1,
  }) async {
    final normalizedDeviceId = deviceId.trim();
    final normalizedPublicKey = publicKey.trim();

    if (normalizedDeviceId.isEmpty) {
      throw const ChatApiException('Encryption device ID is required.');
    }

    if (normalizedPublicKey.isEmpty) {
      throw const ChatApiException('Encryption public key is required.');
    }

    await _request(
      path: '/chat/e2ee/device',
      method: 'POST',
      payload: {
        'deviceId': normalizedDeviceId,
        'publicKey': normalizedPublicKey,
        'keyVersion': keyVersion,
      },
    );
  }

  Future<Map<String, dynamic>> getE2eeParticipants(String callSessionId) async {
    final normalizedId = _normalizeId(callSessionId);

    final body = await _request(
      path: '/chat/e2ee/${Uri.encodeComponent(normalizedId)}/participants',
      method: 'GET',
    );

    return _readData(body);
  }

  Future<ChatMessage> sendEncryptedTextMessage({
    required String callSessionId,
    required String encryptedContent,
    required String encryptionNonce,
    required String encryptionMac,
    required int encryptionVersion,
    String? clientMessageId,
    String? replyToMessageId,
  }) async {
    final normalizedId = _normalizeId(callSessionId);
    final normalizedCiphertext = encryptedContent.trim();
    final normalizedNonce = encryptionNonce.trim();
    final normalizedMac = encryptionMac.trim();

    if (normalizedCiphertext.isEmpty ||
        normalizedNonce.isEmpty ||
        normalizedMac.isEmpty) {
      throw const ChatApiException('Secure message payload is incomplete.');
    }

    final body = await _request(
      path: '/chat/message',
      method: 'POST',
      payload: {
        'callSessionId': normalizedId,
        'messageType': 'TEXT',
        'encryptedContent': normalizedCiphertext,
        'encryptionNonce': normalizedNonce,
        'encryptionMac': normalizedMac,
        'encryptionVersion': encryptionVersion,
        if (clientMessageId?.trim().isNotEmpty == true)
          'clientMessageId': clientMessageId!.trim(),
        if (replyToMessageId?.trim().isNotEmpty == true)
          'replyToMessageId': replyToMessageId!.trim(),
      },
    );

    final data = _readData(body);
    final messageSource = data['message'];

    if (messageSource is! Map) {
      throw const ChatApiException(
        'The server returned an invalid secure chat message.',
      );
    }

    final message = ChatMessage.fromJson(
      Map<String, dynamic>.from(messageSource),
    );

    if (message.id.isEmpty) {
      throw const ChatApiException(
        'The server did not return the secure message.',
      );
    }

    return message;
  }

  Future<ChatMessage> sendTextMessage({
    required String callSessionId,
    required String content,
    String? clientMessageId,
    String? replyToMessageId,
  }) async {
    final normalizedId = _normalizeId(callSessionId);
    final normalizedContent = content.trim();

    if (normalizedContent.isEmpty) {
      throw const ChatApiException('Message cannot be empty.');
    }

    final body = await _request(
      path: '/chat/message',
      method: 'POST',
      payload: {
        'callSessionId': normalizedId,
        'messageType': 'TEXT',
        'content': normalizedContent,
        if (clientMessageId?.trim().isNotEmpty == true)
          'clientMessageId': clientMessageId!.trim(),
        if (replyToMessageId?.trim().isNotEmpty == true)
          'replyToMessageId': replyToMessageId!.trim(),
      },
    );

    final data = _readData(body);
    final messageSource = data['message'];

    if (messageSource is! Map) {
      throw const ChatApiException(
        'The server returned an invalid chat message.',
      );
    }

    final message = ChatMessage.fromJson(
      Map<String, dynamic>.from(messageSource),
    );

    if (message.id.isEmpty) {
      throw const ChatApiException(
        'The server did not return the sent message.',
      );
    }

    return message;
  }

  Future<ChatMessage> sendAttachmentMessage({
    required String callSessionId,
    required String messageType,
    required String attachmentUrl,
    String? attachmentPath,
    required String attachmentName,
    required String attachmentMimeType,
    required int attachmentSize,
    String? content,
    int? audioDurationMs,
    String? clientMessageId,
  }) async {
    final normalizedId = _normalizeId(callSessionId);
    final normalizedType = messageType.trim().toUpperCase();
    final normalizedUrl = attachmentUrl.trim();
    final normalizedPath = attachmentPath?.trim() ?? '';
    final normalizedName = attachmentName.trim();
    final normalizedMimeType = attachmentMimeType.trim().toLowerCase();

    if (normalizedType != 'IMAGE' &&
        normalizedType != 'STICKER' &&
        normalizedType != 'FILE' &&
        normalizedType != 'AUDIO') {
      throw const ChatApiException(
        'Attachment type must be IMAGE, STICKER, FILE or AUDIO.',
      );
    }

    if (normalizedType == 'AUDIO') {
      if (audioDurationMs == null ||
          audioDurationMs < 1 ||
          audioDurationMs > 10 * 60 * 1000) {
        throw const ChatApiException(
          'Voice note duration must be between 1 ms and 10 minutes.',
        );
      }
    } else if (audioDurationMs != null) {
      throw const ChatApiException(
        'Audio duration is only valid for AUDIO messages.',
      );
    }

    if (normalizedUrl.isEmpty) {
      throw const ChatApiException('Attachment URL is required.');
    }

    if (normalizedName.isEmpty) {
      throw const ChatApiException('Attachment name is required.');
    }

    if (normalizedMimeType.isEmpty) {
      throw const ChatApiException('Attachment MIME type is required.');
    }

    if (attachmentSize <= 0) {
      throw const ChatApiException('Attachment size is invalid.');
    }

    final normalizedContent = content?.trim() ?? '';

    final body = await _request(
      path: '/chat/message',
      method: 'POST',
      payload: {
        'callSessionId': normalizedId,
        'messageType': normalizedType,
        'attachmentUrl': normalizedUrl,
        if (normalizedPath.isNotEmpty) 'attachmentPath': normalizedPath,
        'attachmentName': normalizedName,
        'attachmentMimeType': normalizedMimeType,
        'attachmentSize': attachmentSize,
        if (normalizedType == 'AUDIO') 'audioDurationMs': audioDurationMs,
        if (normalizedContent.isNotEmpty) 'content': normalizedContent,
        if (clientMessageId?.trim().isNotEmpty == true)
          'clientMessageId': clientMessageId!.trim(),
      },
    );

    final data = _readData(body);
    final messageSource = data['message'];

    if (messageSource is! Map) {
      throw const ChatApiException(
        'The server returned an invalid attachment message.',
      );
    }

    final message = ChatMessage.fromJson(
      Map<String, dynamic>.from(messageSource),
    );

    if (message.id.isEmpty) {
      throw const ChatApiException(
        'The server did not return the sent attachment.',
      );
    }

    return message;
  }

  Future<ChatSafetyStatus> getSafetyStatus(String userId) async {
    final normalizedUserId = _normalizeId(userId);

    final body = await _request(
      path: '/chat/safety/status/${Uri.encodeComponent(normalizedUserId)}',
      method: 'GET',
    );

    final data = _readData(body);

    return ChatSafetyStatus.fromJson(data);
  }

  Future<void> blockUser(String userId) async {
    final normalizedUserId = _normalizeId(userId);

    await _request(
      path: '/chat/safety/block',
      method: 'POST',
      payload: {'userId': normalizedUserId},
    );
  }

  Future<void> unblockUser(String userId) async {
    final normalizedUserId = _normalizeId(userId);

    await _request(
      path: '/chat/safety/block/${Uri.encodeComponent(normalizedUserId)}',
      method: 'DELETE',
    );
  }

  Future<void> reportUser({
    required String reportedUserId,
    required String reason,
    String? details,
    String? callSessionId,
  }) async {
    final normalizedUserId = _normalizeId(reportedUserId);
    final normalizedReason = reason.trim();
    final normalizedDetails = details?.trim() ?? '';
    final normalizedCallSessionId = callSessionId?.trim() ?? '';

    if (normalizedReason.isEmpty) {
      throw const ChatApiException('Please select a report reason.');
    }

    await _request(
      path: '/chat/safety/report',
      method: 'POST',
      payload: {
        'reportedUserId': normalizedUserId,
        'reason': normalizedReason,
        if (normalizedDetails.isNotEmpty) 'details': normalizedDetails,
        if (normalizedCallSessionId.isNotEmpty)
          'callSessionId': normalizedCallSessionId,
      },
    );
  }

  Future<void> markAllMessagesRead(String callSessionId) async {
    final normalizedId = _normalizeId(callSessionId);

    await _request(
      path: '/chat/${Uri.encodeComponent(normalizedId)}/read-all',
      method: 'PATCH',
    );
  }

  Future<Map<String, dynamic>> _request({
    required String path,
    required String method,
    Map<String, dynamic>? payload,
  }) async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const ChatApiException(
        'Please login to access chat.',
        code: 'LOGIN_REQUIRED',
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamedResponse = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);
      final response = await http.Response.fromStream(streamedResponse);
      final body = _decodeBody(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body['success'] == true) {
        return body;
      }

      final message = _readMessage(body, fallback: 'Chat request failed.');

      throw ChatApiException(
        response.statusCode == 401
            ? 'Your session has expired. Please login again.'
            : message,
        code: response.statusCode == 401 ? 'LOGIN_REQUIRED' : 'CHAT_ERROR',
      );
    } on ChatApiException {
      rethrow;
    } catch (_) {
      throw const ChatApiException(
        'Unable to connect to chat. Please try again.',
        code: 'CONNECTION_ERROR',
      );
    }
  }

  String _normalizeId(String value) {
    final normalized = value.trim();

    if (normalized.isEmpty) {
      throw const ChatApiException('Consultation ID is required.');
    }

    return normalized;
  }

  Map<String, dynamic> _readData(Map<String, dynamic> body) {
    final data = body['data'];

    if (data is! Map) {
      throw const ChatApiException('The server returned invalid chat data.');
    }

    return Map<String, dynamic>.from(data);
  }

  Map<String, dynamic> _decodeBody(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // A consistent error is returned by the caller.
    }

    return <String, dynamic>{};
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
