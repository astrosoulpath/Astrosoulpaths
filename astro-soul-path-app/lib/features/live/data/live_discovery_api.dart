import 'live_api.dart';
import 'live_models.dart';
import 'live_v2_api.dart';

class LiveDiscoveryPage {
  const LiveDiscoveryPage(this.sessions, this.nextOffset);
  final List<LiveSession> sessions;
  final int? nextOffset;
}

class LiveDiscoveryApi {
  LiveDiscoveryApi({
    LiveApi? legacy,
    LiveV2Api? v2,
    this.enabled = liveV2Enabled,
  }) : _legacy = legacy ?? LiveApi(),
       _v2 = v2 ?? LiveV2Api();

  final LiveApi _legacy;
  final LiveV2Api _v2;
  final bool enabled;

  Future<LiveDiscoveryPage> getPage({int offset = 0, int limit = 20}) async {
    if (!enabled) {
      return LiveDiscoveryPage(await _legacy.getLiveSessions(), null);
    }
    final data = await _v2.discoveryPage(offset: offset, limit: limit);
    final raw = data['sessions'];
    final next = data['nextOffset'];
    if (raw is! List || (next != null && (next is! int || next <= offset))) {
      throw const LiveApiException('Invalid Live discovery response.');
    }
    final sessions = <LiveSession>[];
    for (final item in raw) {
      if (item is! Map || item['connectionProtocol'] != 2) {
        throw const LiveApiException('Invalid Live discovery protocol.');
      }
      final session = LiveSession.fromJson(Map<String, dynamic>.from(item));
      if (session.id.isEmpty) {
        throw const LiveApiException('Invalid Live discovery session.');
      }
      if (session.isLive) sessions.add(session);
    }
    return LiveDiscoveryPage(List.unmodifiable(sessions), next as int?);
  }

  Future<List<LiveSession>> getLiveSessions() async =>
      (await getPage()).sessions;

  void close() {
    _legacy.close();
    _v2.close();
  }
}

// Keep offsets on failure and coalesce rapid load-more taps. Refresh replaces
// the feed; pagination de-duplicates sessions that move while offset paging.
class LiveDiscoveryFeed {
  LiveDiscoveryFeed(this.api);
  final LiveDiscoveryApi api;
  List<LiveSession> sessions = const [];
  int? nextOffset;
  bool busy = false;
  Future<void> load({bool more = false}) async {
    if (busy || (more && nextOffset == null)) return;
    busy = true;
    try {
      final page = await api.getPage(offset: more ? nextOffset! : 0);
      final byId = <String, LiveSession>{
        if (more)
          for (final session in sessions) session.id: session,
        for (final session in page.sessions) session.id: session,
      };
      sessions = List.unmodifiable(byId.values);
      nextOffset = page.nextOffset;
    } finally {
      busy = false;
    }
  }
}
