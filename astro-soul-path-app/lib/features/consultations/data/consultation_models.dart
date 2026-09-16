import '../../wallet/data/customer_wallet.dart';

enum ConsultationMode { chat, audio, video }

extension ConsultationModeDetails on ConsultationMode {
  String get apiValue => name;

  String get label => switch (this) {
    ConsultationMode.chat => 'Chat',
    ConsultationMode.audio => 'Audio Call',
    ConsultationMode.video => 'Video Call',
  };
}

class ConsultationSession {
  const ConsultationSession({
    required this.id,
    this.callSessionId = '',
    required this.userId,
    required this.astrologerId,
    required this.channelName,
    required this.mode,
    required this.ratePerMinute,
    required this.purchasedMinutes,
    required this.extendedMinutes,
    required this.amountCharged,
    required this.status,
    required this.startedAt,
    required this.expiresAt,
    required this.endedAt,
  });

  factory ConsultationSession.fromJson(Map<String, dynamic> json) {
    return ConsultationSession(
      id: _readString(json['id']),
      callSessionId: json['callSessionId']?.toString().trim() ?? '',
      userId: _readString(json['userId']),
      astrologerId: _readString(json['astrologerId']),
      channelName: _readString(json['channelName']),
      mode: _readString(json['mode']),
      ratePerMinute: _readDouble(json['ratePerMinute']),
      purchasedMinutes: _readInt(json['purchasedMinutes']),
      extendedMinutes: _readInt(json['extendedMinutes']),
      amountCharged: _readDouble(json['amountCharged']),
      status: _readString(json['status']),
      startedAt: _readDate(json['startedAt']),
      expiresAt: _readDate(json['expiresAt']),
      endedAt: _readNullableDate(json['endedAt']),
    );
  }

  final String id;

  final String callSessionId;
  final String userId;
  final String astrologerId;
  final String channelName;
  final String mode;
  final double ratePerMinute;
  final int purchasedMinutes;
  final int extendedMinutes;
  final double amountCharged;
  final String status;
  final DateTime? startedAt;
  final DateTime? expiresAt;
  final DateTime? endedAt;

  static String _readString(Object? value) => value?.toString().trim() ?? '';

  static double _readDouble(Object? value) => value is num
      ? value.toDouble()
      : double.tryParse(value?.toString() ?? '') ?? 0;

  static int _readInt(Object? value) =>
      value is num ? value.toInt() : int.tryParse(value?.toString() ?? '') ?? 0;

  static DateTime? _readDate(Object? value) =>
      DateTime.tryParse(value?.toString() ?? '');

  static DateTime? _readNullableDate(Object? value) {
    final source = value?.toString().trim() ?? '';

    return source.isEmpty ? null : DateTime.tryParse(source);
  }
}

class ConsultationHistoryItem {
  const ConsultationHistoryItem({
    required this.session,
    required this.astrologerName,
    required this.astrologerAvatarUrl,
  });

  factory ConsultationHistoryItem.fromJson(Map<String, dynamic> json) {
    final astrologer = _readMap(json['astrologer']);
    final profile = _readMap(astrologer['profile']);

    final directName = astrologer['name']?.toString().trim() ?? '';
    final profileName = profile['name']?.toString().trim() ?? '';

    final directAvatar = astrologer['avatarUrl']?.toString().trim() ?? '';
    final profileAvatar = profile['avatarUrl']?.toString().trim() ?? '';

    return ConsultationHistoryItem(
      session: ConsultationSession.fromJson(json),
      astrologerName: profileName.isNotEmpty
          ? profileName
          : directName.isNotEmpty
          ? directName
          : 'Astrologer',
      astrologerAvatarUrl: profileAvatar.isNotEmpty
          ? profileAvatar
          : directAvatar,
    );
  }

  final ConsultationSession session;
  final String astrologerName;
  final String astrologerAvatarUrl;

  static Map<String, dynamic> _readMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return <String, dynamic>{};
  }
}

class ConsultationQueuePosition {
  const ConsultationQueuePosition({
    required this.consultationId,
    required this.status,
    required this.position,
    required this.customersAhead,
    required this.isNext,
  });

  factory ConsultationQueuePosition.fromJson(Map<String, dynamic> json) {
    final rawPosition = json['position'];

    return ConsultationQueuePosition(
      consultationId: json['consultationId']?.toString().trim() ?? '',
      status: json['status']?.toString().trim().toUpperCase() ?? '',
      position: rawPosition == null
          ? null
          : rawPosition is num
          ? rawPosition.toInt()
          : int.tryParse(rawPosition.toString()),
      customersAhead: json['customersAhead'] is num
          ? (json['customersAhead'] as num).toInt()
          : int.tryParse(json['customersAhead']?.toString() ?? '') ?? 0,
      isNext: json['isNext'] == true,
    );
  }

  final String consultationId;
  final String status;
  final int? position;
  final int customersAhead;
  final bool isNext;
}

class StartConsultationResult {
  const StartConsultationResult({
    required this.message,
    required this.session,
    required this.wallet,
  });

  final String message;
  final ConsultationSession session;
  final CustomerWallet wallet;
}
