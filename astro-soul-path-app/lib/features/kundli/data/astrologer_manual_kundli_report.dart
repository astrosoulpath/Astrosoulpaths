class AstrologerManualKundliReportAttachment {
  const AstrologerManualKundliReportAttachment({
    required this.id,
    required this.fileName,
    required this.mimeType,
    required this.sizeBytes,
    required this.storageUrl,
    this.storagePath,
  });

  final String id;
  final String fileName;
  final String mimeType;
  final int sizeBytes;
  final String storageUrl;
  final String? storagePath;

  factory AstrologerManualKundliReportAttachment.fromJson(
    Map<String, dynamic> json,
  ) {
    return AstrologerManualKundliReportAttachment(
      id: json['id']?.toString() ?? '',
      fileName: json['fileName']?.toString() ?? '',
      mimeType: json['mimeType']?.toString() ?? '',
      sizeBytes: int.tryParse(json['sizeBytes']?.toString() ?? '') ?? 0,
      storageUrl: json['storageUrl']?.toString() ?? '',
      storagePath: json['storagePath']?.toString(),
    );
  }
}

class AstrologerManualKundliReport {
  const AstrologerManualKundliReport({
    required this.id,
    required this.callSessionId,
    required this.customerUserId,
    required this.astrologerId,
    required this.status,
    required this.attachments,
    this.title,
    this.summary,
    this.character,
    this.career,
    this.marriage,
    this.finance,
    this.health,
    this.remedies,
    this.notes,
    this.finalizedAt,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String callSessionId;
  final String customerUserId;
  final String astrologerId;
  final String status;

  final String? title;
  final String? summary;
  final String? character;
  final String? career;
  final String? marriage;
  final String? finance;
  final String? health;
  final String? remedies;
  final String? notes;

  final DateTime? finalizedAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  final List<AstrologerManualKundliReportAttachment> attachments;

  bool get isDraft => status.toUpperCase() == 'DRAFT';
  bool get isFinal => status.toUpperCase() == 'FINAL';

  factory AstrologerManualKundliReport.fromJson(Map<String, dynamic> json) {
    final rawAttachments = json['attachments'];

    final attachments = rawAttachments is List
        ? rawAttachments
              .whereType<Map>()
              .map(
                (item) => AstrologerManualKundliReportAttachment.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <AstrologerManualKundliReportAttachment>[];

    return AstrologerManualKundliReport(
      id: json['id']?.toString() ?? '',
      callSessionId: json['callSessionId']?.toString() ?? '',
      customerUserId: json['customerUserId']?.toString() ?? '',
      astrologerId: json['astrologerId']?.toString() ?? '',
      status: json['status']?.toString() ?? '',
      title: json['title']?.toString(),
      summary: json['summary']?.toString(),
      character: json['character']?.toString(),
      career: json['career']?.toString(),
      marriage: json['marriage']?.toString(),
      finance: json['finance']?.toString(),
      health: json['health']?.toString(),
      remedies: json['remedies']?.toString(),
      notes: json['notes']?.toString(),
      finalizedAt: _parseDate(json['finalizedAt']),
      createdAt: _parseDate(json['createdAt']),
      updatedAt: _parseDate(json['updatedAt']),
      attachments: attachments,
    );
  }

  static DateTime? _parseDate(dynamic value) {
    final text = value?.toString().trim() ?? '';

    if (text.isEmpty) {
      return null;
    }

    return DateTime.tryParse(text);
  }
}
