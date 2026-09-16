class CallRtcCredentials {
  const CallRtcCredentials({
    required this.callId,
    required this.appId,
    required this.token,
    required this.channelName,
    required this.uid,
    required this.role,
    required this.tokenExpiresAt,
    required this.callExpiresAt,
    required this.raw,
  });

  factory CallRtcCredentials.fromResponse(Map<String, dynamic> response) {
    final source = _unwrapData(response);

    final callSource = source['call'];
    final call = callSource is Map
        ? Map<String, dynamic>.from(callSource)
        : <String, dynamic>{};

    final callId = _string(call['id']).isNotEmpty
        ? _string(call['id'])
        : _string(source['callId']);

    final appId = _string(source['appId']);
    final token = _string(source['token']);
    final channelName = _string(source['channelName']);

    final uid = _int(source['uid']);

    if (appId.isEmpty) {
      throw const FormatException(
        'Agora App ID was not returned by the server.',
      );
    }

    if (token.isEmpty) {
      throw const FormatException(
        'Agora token was not returned by the server.',
      );
    }

    if (channelName.isEmpty) {
      throw const FormatException(
        'Agora channel name was not returned by the server.',
      );
    }

    if (uid <= 0) {
      throw const FormatException(
        'Agora UID returned by the server is invalid.',
      );
    }

    return CallRtcCredentials(
      callId: callId,
      appId: appId,
      token: token,
      channelName: channelName,
      uid: uid,
      role: _string(source['role']),
      tokenExpiresAt: _dateFromUnixOrIso(source['expiresAt']),
      callExpiresAt: _date(call['expiresAt']),
      raw: Map<String, dynamic>.unmodifiable(source),
    );
  }

  final String callId;
  final String appId;
  final String token;
  final String channelName;
  final int uid;
  final String role;
  final DateTime? tokenExpiresAt;
  final DateTime? callExpiresAt;
  final Map<String, dynamic> raw;

  static Map<String, dynamic> _unwrapData(Map<String, dynamic> response) {
    final data = response['data'];

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    return Map<String, dynamic>.from(response);
  }

  static String _string(Object? value) => value?.toString().trim() ?? '';

  static int _int(Object? value) {
    if (value is int) {
      return value;
    }

    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static DateTime? _date(Object? value) {
    final source = value?.toString().trim() ?? '';

    if (source.isEmpty) {
      return null;
    }

    return DateTime.tryParse(source);
  }

  static DateTime? _dateFromUnixOrIso(Object? value) {
    if (value is int) {
      return DateTime.fromMillisecondsSinceEpoch(value * 1000, isUtc: true);
    }

    if (value is num) {
      return DateTime.fromMillisecondsSinceEpoch(
        value.toInt() * 1000,
        isUtc: true,
      );
    }

    final source = value?.toString().trim() ?? '';

    if (source.isEmpty) {
      return null;
    }

    final unix = int.tryParse(source);

    if (unix != null) {
      return DateTime.fromMillisecondsSinceEpoch(unix * 1000, isUtc: true);
    }

    return DateTime.tryParse(source);
  }
}

class CurrentCallSession {
  const CurrentCallSession({
    required this.id,
    required this.channelName,
    required this.status,
    required this.remainingSeconds,
    required this.expiresAt,
    required this.raw,
  });

  factory CurrentCallSession.fromJson(Map<String, dynamic> json) {
    return CurrentCallSession(
      id: json['id']?.toString().trim() ?? '',
      channelName: json['channelName']?.toString().trim() ?? '',
      status: json['status']?.toString().trim().toUpperCase() ?? '',
      remainingSeconds:
          int.tryParse(json['remainingSeconds']?.toString() ?? '') ?? 0,
      expiresAt: DateTime.tryParse(json['expiresAt']?.toString() ?? ''),
      raw: Map<String, dynamic>.unmodifiable(json),
    );
  }

  final String id;
  final String channelName;
  final String status;
  final int remainingSeconds;
  final DateTime? expiresAt;
  final Map<String, dynamic> raw;
}
