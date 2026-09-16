import '../../../core/config/api_config.dart';

class ChatParticipant {
  const ChatParticipant({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.rating,
    required this.totalReviews,
    required this.expertise,
    this.context = const <String, dynamic>{},
  });

  factory ChatParticipant.fromJson(Map<String, dynamic> json) {
    final rawExpertise = json['expertise'];
    final expertise = <String>[];

    if (rawExpertise is List) {
      for (final item in rawExpertise) {
        final value = item?.toString().trim() ?? '';

        if (value.isNotEmpty) {
          expertise.add(value);
        }
      }
    }

    return ChatParticipant(
      id: json['id']?.toString().trim() ?? '',
      name: json['name']?.toString().trim() ?? '',
      avatarUrl: json['avatarUrl']?.toString().trim().isNotEmpty == true
          ? json['avatarUrl'].toString().trim()
          : null,
      rating: double.tryParse(json['rating']?.toString() ?? ''),
      totalReviews: int.tryParse(json['totalReviews']?.toString() ?? '') ?? 0,
      expertise: List.unmodifiable(expertise),
      context: json['context'] is Map
          ? Map<String, dynamic>.from(json['context'] as Map)
          : const <String, dynamic>{},
    );
  }

  final String id;
  final String name;
  final String? avatarUrl;
  final double? rating;
  final int totalReviews;
  final List<String> expertise;
  final Map<String, dynamic> context;
}

class ChatReplyPreview {
  const ChatReplyPreview({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.senderIsAstrologer,
    required this.messageType,
    required this.content,
    this.encryptedContent,
    this.encryptionNonce,
    this.encryptionMac,
    this.encryptionVersion,
    required this.attachmentUrl,
    required this.attachmentName,
  });

  factory ChatReplyPreview.fromJson(Map<String, dynamic> json) {
    final senderSource = json['sender'];
    final sender = senderSource is Map
        ? Map<String, dynamic>.from(senderSource)
        : <String, dynamic>{};

    final attachmentSource = json['attachment'];
    final attachment = attachmentSource is Map
        ? Map<String, dynamic>.from(attachmentSource)
        : <String, dynamic>{};
    String? normalizeChatMediaUrl(dynamic value) {
      final raw = value?.toString().trim() ?? '';

      if (raw.isEmpty) {
        return null;
      }

      final apiBase = Uri.tryParse(ApiConfig.baseUrl);
      final parsed = Uri.tryParse(raw);

      if (apiBase == null || parsed == null) {
        return raw;
      }

      if (!parsed.hasScheme) {
        final path = raw.startsWith('/') ? raw : '/$raw';
        final relative = Uri.tryParse(path);

        if (relative == null) {
          return raw;
        }

        return apiBase
            .replace(
              path: relative.path,
              query: relative.hasQuery ? relative.query : null,
              fragment: relative.hasFragment ? relative.fragment : null,
            )
            .toString();
      }

      final host = parsed.host.toLowerCase();

      if (host == 'localhost' || host == '127.0.0.1' || host == '0.0.0.0') {
        return apiBase
            .replace(
              path: parsed.path,
              query: parsed.hasQuery ? parsed.query : null,
              fragment: parsed.hasFragment ? parsed.fragment : null,
            )
            .toString();
      }

      return raw;
    }

    return ChatReplyPreview(
      id: json['id']?.toString().trim() ?? '',
      senderId: json['senderId']?.toString().trim() ?? '',
      senderName: sender['name']?.toString().trim() ?? '',
      senderIsAstrologer: sender['isAstrologer'] == true,
      messageType: json['messageType']?.toString().trim() ?? 'TEXT',
      content: json['content']?.toString(),
      encryptedContent: json['encryptedContent']?.toString().trim(),
      encryptionNonce: json['encryptionNonce']?.toString().trim(),
      encryptionMac: json['encryptionMac']?.toString().trim(),
      encryptionVersion: int.tryParse(
        json['encryptionVersion']?.toString() ?? '',
      ),
      attachmentUrl: normalizeChatMediaUrl(
        attachment['url']?.toString().trim().isNotEmpty == true
            ? attachment['url']
            : json['attachmentUrl'],
      ),
      attachmentName: attachment['name']?.toString().trim().isNotEmpty == true
          ? attachment['name']?.toString().trim()
          : json['attachmentName']?.toString().trim(),
    );
  }

  final String id;
  final String senderId;
  final String senderName;
  final bool senderIsAstrologer;
  final String messageType;
  final String? content;
  final String? encryptedContent;
  final String? encryptionNonce;
  final String? encryptionMac;
  final int? encryptionVersion;
  final String? attachmentUrl;
  final String? attachmentName;
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.callSessionId,
    required this.senderId,
    required this.senderName,
    required this.senderIsAstrologer,
    required this.clientMessageId,
    this.replyToMessageId,
    this.replyToMessage,
    required this.messageType,
    required this.content,
    this.encryptedContent,
    this.encryptionNonce,
    this.encryptionMac,
    this.encryptionVersion,
    required this.attachmentUrl,
    required this.attachmentName,
    required this.attachmentMimeType,
    required this.attachmentSize,
    this.audioDurationMs,
    required this.isRead,
    required this.readAt,
    required this.createdAt,
    this.deliveryStatus = 'SENT',
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    final senderSource = json['sender'];
    final sender = senderSource is Map
        ? Map<String, dynamic>.from(senderSource)
        : <String, dynamic>{};

    final attachmentSource = json['attachment'];
    final attachment = attachmentSource is Map
        ? Map<String, dynamic>.from(attachmentSource)
        : <String, dynamic>{};
    String? normalizeChatMediaUrl(dynamic value) {
      final raw = value?.toString().trim() ?? '';

      if (raw.isEmpty) {
        return null;
      }

      final apiBase = Uri.tryParse(ApiConfig.baseUrl);
      final parsed = Uri.tryParse(raw);

      if (apiBase == null || parsed == null) {
        return raw;
      }

      if (!parsed.hasScheme) {
        final path = raw.startsWith('/') ? raw : '/$raw';
        final relative = Uri.tryParse(path);

        if (relative == null) {
          return raw;
        }

        return apiBase
            .replace(
              path: relative.path,
              query: relative.hasQuery ? relative.query : null,
              fragment: relative.hasFragment ? relative.fragment : null,
            )
            .toString();
      }

      final host = parsed.host.toLowerCase();

      if (host == 'localhost' || host == '127.0.0.1' || host == '0.0.0.0') {
        return apiBase
            .replace(
              path: parsed.path,
              query: parsed.hasQuery ? parsed.query : null,
              fragment: parsed.hasFragment ? parsed.fragment : null,
            )
            .toString();
      }

      return raw;
    }

    return ChatMessage(
      id: json['id']?.toString().trim() ?? '',
      callSessionId: json['callSessionId']?.toString().trim() ?? '',
      senderId: json['senderId']?.toString().trim() ?? '',
      senderName: sender['name']?.toString().trim() ?? '',
      senderIsAstrologer: sender['isAstrologer'] == true,
      clientMessageId: json['clientMessageId']?.toString().trim() ?? '',
      replyToMessageId: json['replyToMessageId']?.toString().trim(),
      replyToMessage: json['replyToMessage'] is Map
          ? ChatReplyPreview.fromJson(
              Map<String, dynamic>.from(json['replyToMessage'] as Map),
            )
          : null,
      messageType: json['messageType']?.toString().trim() ?? 'TEXT',
      content: json['content']?.toString(),
      encryptedContent: json['encryptedContent']?.toString().trim(),
      encryptionNonce: json['encryptionNonce']?.toString().trim(),
      encryptionMac: json['encryptionMac']?.toString().trim(),
      encryptionVersion: int.tryParse(
        json['encryptionVersion']?.toString() ?? '',
      ),
      attachmentUrl: normalizeChatMediaUrl(
        attachment['url']?.toString().trim().isNotEmpty == true
            ? attachment['url']
            : json['attachmentUrl'],
      ),
      attachmentName: attachment['name']?.toString().trim().isNotEmpty == true
          ? attachment['name']?.toString().trim()
          : json['attachmentName']?.toString().trim(),
      attachmentMimeType:
          attachment['mimeType']?.toString().trim().isNotEmpty == true
          ? attachment['mimeType']?.toString().trim()
          : json['attachmentMimeType']?.toString().trim(),
      attachmentSize:
          int.tryParse(
            (attachment['size'] ?? json['attachmentSize'])?.toString() ?? '',
          ) ??
          0,
      audioDurationMs: int.tryParse(
        (attachment['audioDurationMs'] ?? json['audioDurationMs'])
                ?.toString() ??
            '',
      ),
      isRead: json['isRead'] == true,
      readAt: DateTime.tryParse(json['readAt']?.toString() ?? ''),
      createdAt: DateTime.tryParse(json['createdAt']?.toString() ?? ''),
    );
  }

  final String id;
  final String callSessionId;
  final String senderId;
  final String senderName;
  final bool senderIsAstrologer;
  final String clientMessageId;
  final String? replyToMessageId;
  final ChatReplyPreview? replyToMessage;
  final String messageType;
  final String? content;
  final String? encryptedContent;
  final String? encryptionNonce;
  final String? encryptionMac;
  final int? encryptionVersion;
  final String? attachmentUrl;
  final String? attachmentName;
  final String? attachmentMimeType;
  final int attachmentSize;
  final int? audioDurationMs;
  final bool isRead;
  final DateTime? readAt;
  final DateTime? createdAt;
  final String deliveryStatus;

  ChatMessage copyWith({
    String? id,
    String? callSessionId,
    String? senderId,
    String? senderName,
    bool? senderIsAstrologer,
    String? clientMessageId,
    String? replyToMessageId,
    ChatReplyPreview? replyToMessage,
    String? messageType,
    String? content,
    String? encryptedContent,
    String? encryptionNonce,
    String? encryptionMac,
    int? encryptionVersion,
    String? attachmentUrl,
    String? attachmentName,
    String? attachmentMimeType,
    int? attachmentSize,
    bool? isRead,
    DateTime? readAt,
    DateTime? createdAt,
    String? deliveryStatus,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      callSessionId: callSessionId ?? this.callSessionId,
      senderId: senderId ?? this.senderId,
      senderName: senderName ?? this.senderName,
      senderIsAstrologer: senderIsAstrologer ?? this.senderIsAstrologer,
      clientMessageId: clientMessageId ?? this.clientMessageId,
      replyToMessageId: replyToMessageId ?? this.replyToMessageId,
      replyToMessage: replyToMessage ?? this.replyToMessage,
      messageType: messageType ?? this.messageType,
      content: content ?? this.content,
      encryptedContent: encryptedContent ?? this.encryptedContent,
      encryptionNonce: encryptionNonce ?? this.encryptionNonce,
      encryptionMac: encryptionMac ?? this.encryptionMac,
      encryptionVersion: encryptionVersion ?? this.encryptionVersion,
      attachmentUrl: attachmentUrl ?? this.attachmentUrl,
      attachmentName: attachmentName ?? this.attachmentName,
      attachmentMimeType: attachmentMimeType ?? this.attachmentMimeType,
      attachmentSize: attachmentSize ?? this.attachmentSize,
      isRead: isRead ?? this.isRead,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
    );
  }
}

class ChatRoom {
  const ChatRoom({
    required this.roomId,
    required this.channelName,
    required this.status,
    required this.startedAt,
    required this.expiresAt,
    required this.endedAt,
    required this.unreadCount,
    required this.currentUser,
    required this.customer,
    required this.astrologer,
  });

  factory ChatRoom.fromJson(Map<String, dynamic> json) {
    return ChatRoom(
      roomId: json['roomId']?.toString().trim() ?? '',
      channelName: json['channelName']?.toString().trim() ?? '',
      status: json['status']?.toString().trim() ?? '',
      startedAt: DateTime.tryParse(json['startedAt']?.toString() ?? ''),
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
      endedAt: DateTime.tryParse(json['endedAt']?.toString() ?? ''),
      unreadCount: int.tryParse(json['unreadCount']?.toString() ?? '') ?? 0,
      currentUser: _readParticipant(json['currentUser']),
      customer: _readParticipant(json['customer']),
      astrologer: _readParticipant(json['astrologer']),
    );
  }

  final String roomId;
  final String channelName;
  final String status;
  final DateTime? startedAt;
  final DateTime? expiresAt;
  final DateTime? endedAt;
  final int unreadCount;
  final ChatParticipant currentUser;
  final ChatParticipant customer;
  final ChatParticipant astrologer;

  static ChatParticipant _readParticipant(Object? source) {
    if (source is Map) {
      return ChatParticipant.fromJson(Map<String, dynamic>.from(source));
    }

    return const ChatParticipant(
      id: '',
      name: '',
      avatarUrl: null,
      rating: null,
      totalReviews: 0,
      expertise: <String>[],
    );
  }
}

class ChatHistory {
  const ChatHistory({
    required this.messages,
    required this.total,
    required this.unreadCount,
  });

  final List<ChatMessage> messages;
  final int total;
  final int unreadCount;
}
