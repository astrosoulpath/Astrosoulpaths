class LiveAstrologer {
  const LiveAstrologer({
    required this.id,
    required this.name,
    required this.rating,
    required this.isVerified,
    this.avatarUrl,
  });

  final String id;
  final String name;
  final String? avatarUrl;
  final double rating;
  final bool isVerified;

  factory LiveAstrologer.fromJson(Map<String, dynamic> json) {
    return LiveAstrologer(
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? 'Astrologer').toString(),
      avatarUrl: json['avatarUrl']?.toString(),
      rating: _toDouble(json['rating']),
      isVerified: json['isVerified'] == true,
    );
  }
}

class LiveSession {
  const LiveSession({
    required this.id,
    required this.astrologerId,
    required this.channelName,
    required this.status,
    required this.startedAt,
    required this.viewerCount,
    required this.astrologer,
    this.title,
    this.endedAt,
  });

  final String id;
  final String astrologerId;
  final String channelName;
  final String? title;
  final String status;
  final DateTime startedAt;
  final DateTime? endedAt;
  final int viewerCount;
  final LiveAstrologer astrologer;

  bool get isLive => status.trim().toUpperCase() == 'LIVE' && endedAt == null;

  factory LiveSession.fromJson(Map<String, dynamic> json) {
    final astrologerJson = json['astrologer'];

    return LiveSession(
      id: (json['id'] ?? '').toString(),
      astrologerId: (json['astrologerId'] ?? '').toString(),
      channelName: (json['channelName'] ?? '').toString(),
      title: json['title']?.toString(),
      status: (json['status'] ?? '').toString(),
      startedAt:
          DateTime.tryParse((json['startedAt'] ?? '').toString()) ??
          DateTime.now(),
      endedAt: json['endedAt'] == null
          ? null
          : DateTime.tryParse(json['endedAt'].toString()),
      viewerCount: _toInt(json['viewerCount']),
      astrologer: LiveAstrologer.fromJson(
        astrologerJson is Map
            ? Map<String, dynamic>.from(astrologerJson)
            : const <String, dynamic>{},
      ),
    );
  }
}

class LiveRtcCredentials {
  const LiveRtcCredentials({
    required this.appId,
    required this.token,
    required this.channelName,
    required this.uid,
    required this.role,
    required this.expiresAt,
  });

  final String appId;
  final String token;
  final String channelName;
  final int uid;
  final String role;
  final int expiresAt;

  factory LiveRtcCredentials.fromJson(Map<String, dynamic> json) {
    return LiveRtcCredentials(
      appId: (json['appId'] ?? '').toString(),
      token: (json['token'] ?? '').toString(),
      channelName: (json['channelName'] ?? '').toString(),
      uid: _toInt(json['uid']),
      role: (json['role'] ?? '').toString(),
      expiresAt: _toInt(json['expiresAt']),
    );
  }
}

class LiveJoinResult {
  const LiveJoinResult({required this.session, required this.rtc});

  final LiveSession session;
  final LiveRtcCredentials rtc;
}

double _toDouble(dynamic value) {
  if (value is num) {
    return value.toDouble();
  }

  return double.tryParse(value?.toString() ?? '') ?? 0;
}

int _toInt(dynamic value) {
  if (value is int) {
    return value;
  }

  if (value is num) {
    return value.toInt();
  }

  return int.tryParse(value?.toString() ?? '') ?? 0;
}
