class SupportTicketSummary {
  const SupportTicketSummary({
    required this.id,
    required this.ticketNumber,
    required this.subject,
    required this.status,
    required this.priority,
    required this.category,
    required this.createdAt,
    this.lastMessageAt,
    this.messageCount = 0,
  });

  final String id;
  final String ticketNumber;
  final String subject;
  final String status;
  final String priority;
  final String category;
  final DateTime createdAt;
  final DateTime? lastMessageAt;
  final int messageCount;

  factory SupportTicketSummary.fromJson(Map<String, dynamic> json) {
    final countJson = json['_count'];

    return SupportTicketSummary(
      id: json['id']?.toString() ?? '',
      ticketNumber: json['ticketNumber']?.toString() ?? '',
      subject: json['subject']?.toString() ?? '',
      status: json['status']?.toString() ?? 'OPEN',
      priority: json['priority']?.toString() ?? 'NORMAL',
      category: json['category']?.toString() ?? 'GENERAL',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      lastMessageAt: DateTime.tryParse(json['lastMessageAt']?.toString() ?? ''),
      messageCount: countJson is Map
          ? int.tryParse(countJson['messages']?.toString() ?? '') ?? 0
          : 0,
    );
  }
}

class SupportMessageModel {
  const SupportMessageModel({
    required this.id,
    required this.content,
    required this.senderType,
    required this.createdAt,
    this.isRead = false,
  });

  final String id;
  final String content;
  final String senderType;
  final DateTime createdAt;
  final bool isRead;

  bool get isCustomer => senderType.toUpperCase() == 'CUSTOMER';

  bool get isAdmin => senderType.toUpperCase() == 'ADMIN';

  bool get isAssistant => senderType.toUpperCase() == 'ASSISTANT';

  factory SupportMessageModel.fromJson(Map<String, dynamic> json) {
    return SupportMessageModel(
      id: json['id']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      senderType: json['senderType']?.toString() ?? 'SYSTEM',
      createdAt:
          DateTime.tryParse(json['createdAt']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      isRead: json['isRead'] == true,
    );
  }
}

class SupportAttachmentModel {
  const SupportAttachmentModel({
    required this.id,
    required this.originalFileName,
    required this.contentType,
    required this.sizeBytes,
    required this.url,
  });

  final String id;
  final String originalFileName;
  final String contentType;
  final int sizeBytes;
  final String url;

  factory SupportAttachmentModel.fromJson(Map<String, dynamic> json) {
    return SupportAttachmentModel(
      id: json['id']?.toString() ?? '',
      originalFileName:
          json['originalFileName']?.toString().trim().isNotEmpty == true
          ? json['originalFileName'].toString().trim()
          : 'Attachment',
      contentType: json['contentType']?.toString() ?? '',
      sizeBytes: int.tryParse(json['sizeBytes']?.toString() ?? '') ?? 0,
      url: json['url']?.toString() ?? '',
    );
  }
}

class SupportTicketDetail {
  const SupportTicketDetail({
    required this.id,
    required this.ticketNumber,
    required this.subject,
    required this.status,
    required this.priority,
    required this.category,
    required this.messages,
    this.description,
    this.attachments = const [],
  });

  final String id;
  final String ticketNumber;
  final String subject;
  final String? description;
  final String status;
  final String priority;
  final String category;
  final List<SupportMessageModel> messages;
  final List<SupportAttachmentModel> attachments;

  factory SupportTicketDetail.fromJson(Map<String, dynamic> json) {
    final rawMessages = json['messages'];
    final rawAttachments = json['attachments'];

    return SupportTicketDetail(
      id: json['id']?.toString() ?? '',
      ticketNumber: json['ticketNumber']?.toString() ?? '',
      subject: json['subject']?.toString() ?? '',
      description: json['description']?.toString(),
      status: json['status']?.toString() ?? 'OPEN',
      priority: json['priority']?.toString() ?? 'NORMAL',
      category: json['category']?.toString() ?? 'GENERAL',
      messages: rawMessages is List
          ? rawMessages
                .whereType<Map>()
                .map(
                  (item) => SupportMessageModel.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : const [],
      attachments: rawAttachments is List
          ? rawAttachments
                .whereType<Map>()
                .map(
                  (item) => SupportAttachmentModel.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .where((item) => item.url.trim().isNotEmpty)
                .toList()
          : const [],
    );
  }
}

class AssistantConversationModel {
  const AssistantConversationModel({
    required this.id,
    required this.status,
    required this.messages,
    this.supportTicketId,
  });

  final String id;
  final String status;
  final String? supportTicketId;
  final List<SupportMessageModel> messages;

  factory AssistantConversationModel.fromJson(Map<String, dynamic> json) {
    final rawMessages = json['messages'];

    final ticket = json['supportTicket'];

    return AssistantConversationModel(
      id: json['id']?.toString() ?? '',
      status: json['status']?.toString() ?? 'ACTIVE',
      supportTicketId:
          json['supportTicketId']?.toString() ??
          (ticket is Map ? ticket['id']?.toString() : null),
      messages: rawMessages is List
          ? rawMessages
                .whereType<Map>()
                .map(
                  (item) => SupportMessageModel.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList()
          : const [],
    );
  }
}

class AssistantSendResult {
  const AssistantSendResult({
    required this.customerMessage,
    this.assistantReply,
    required this.providerStatus,
  });

  final SupportMessageModel customerMessage;
  final SupportMessageModel? assistantReply;
  final String providerStatus;
}
