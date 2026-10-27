import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/live/data/live_api.dart';
import 'package:astro_soul_path/features/live/data/live_discovery_api.dart';
import 'package:astro_soul_path/features/live/data/live_v2_api.dart';

class DiscoverySessions extends Fake implements AuthSessionStore {
  bool authenticated = true;
  int refreshes = 0;
  @override
  Future<StoredAuthSession?> read() async => authenticated
      ? StoredAuthSession(
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          role: 'Customer',
          portal: 'customer',
          nextStep: 'dashboard',
          user: {'id': 'canonical'},
          expiresIn: 3600,
        )
      : null;
  @override
  Future<StoredAuthSession?> forceRefresh() {
    refreshes++;
    return read();
  }
}

void main() {
  final session = <String, dynamic>{
    'id': 'live',
    'astrologerId': 'astro',
    'status': 'LIVE',
    'connectionProtocol': 2,
    'startedAt': '2026-10-14T00:00:00Z',
    'viewerCount': 3,
    'astrologer': {'id': 'astro', 'name': 'Host', 'isVerified': true},
  };
  test(
    'flag stays disabled and default discovery preserves public legacy path',
    () async {
      expect(liveV2Enabled, isFalse);
      final api = LiveDiscoveryApi(
        legacy: LiveApi(
          client: MockClient((request) async {
            expect(request.url.path, '/live');
            expect(request.headers.containsKey('Authorization'), isFalse);
            return http.Response(
              jsonEncode({
                'data': [
                  {...session, 'connectionProtocol': 1},
                ],
              }),
              200,
            );
          }),
        ),
      );
      expect((await api.getLiveSessions()).single.connectionProtocol, 1);
      api.close();
    },
  );
  test('enabled discovery authenticates v2 and preserves pagination', () async {
    final api = LiveDiscoveryApi(
      enabled: true,
      v2: LiveV2Api(
        sessions: DiscoverySessions(),
        client: MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/live/v2');
          expect(request.url.queryParameters, {'offset': '2', 'limit': '1'});
          expect(request.headers['Authorization'], 'Bearer mock-token');
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'sessions': [session],
                'nextOffset': 3,
              },
            }),
            200,
          );
        }),
      ),
    );
    final page = await api.getPage(offset: 2, limit: 1);
    expect(page.sessions.single.connectionProtocol, 2);
    expect(page.sessions.single.viewerCount, 3);
    expect(page.nextOffset, 3);
    api.close();
  });
  test('unauthenticated discovery makes no request', () async {
    final sessions = DiscoverySessions()..authenticated = false;
    final api = LiveDiscoveryApi(
      enabled: true,
      v2: LiveV2Api(
        sessions: sessions,
        client: MockClient((_) async => throw StateError('must not request')),
      ),
    );
    await expectLater(api.getLiveSessions(), throwsA(isA<LiveApiException>()));
    api.close();
  });
  test(
    '401 refreshes once without falling back to public legacy discovery',
    () async {
      final sessions = DiscoverySessions();
      var calls = 0;
      final api = LiveDiscoveryApi(
        enabled: true,
        v2: LiveV2Api(
          sessions: sessions,
          client: MockClient((request) async {
            calls++;
            expect(request.url.path, '/live/v2');
            return http.Response('{}', 401);
          }),
        ),
      );
      await expectLater(
        api.getLiveSessions(),
        throwsA(isA<LiveApiException>()),
      );
      expect(calls, 2);
      expect(sessions.refreshes, 1);
      api.close();
    },
  );
  for (final invalid in ['legacy', 'malformed', 'pagination']) {
    test('rejects $invalid discovery response', () async {
      final data = invalid == 'malformed'
          ? {'sessions': 'invalid'}
          : {
              'sessions': [
                {...session, if (invalid == 'legacy') 'connectionProtocol': 1},
              ],
              'nextOffset': invalid == 'pagination' ? 0 : null,
            };
      final api = LiveDiscoveryApi(
        enabled: true,
        v2: LiveV2Api(
          sessions: DiscoverySessions(),
          client: MockClient(
            (_) async =>
                http.Response(jsonEncode({'success': true, 'data': data}), 200),
          ),
        ),
      );
      await expectLater(
        api.getLiveSessions(),
        throwsA(isA<LiveApiException>()),
      );
      api.close();
    });
  }
  test('filters ended sessions and validates pagination locally', () async {
    var calls = 0;
    final api = LiveDiscoveryApi(
      enabled: true,
      v2: LiveV2Api(
        sessions: DiscoverySessions(),
        client: MockClient((_) async {
          calls++;
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'sessions': [
                  {...session, 'status': 'ENDED'},
                ],
                'nextOffset': null,
              },
            }),
            200,
          );
        }),
      ),
    );
    expect(await api.getLiveSessions(), isEmpty);
    await expectLater(api.getPage(limit: 51), throwsA(isA<LiveApiException>()));
    expect(calls, 1);
    api.close();
  });
  test(
    'feed loads next page once, deduplicates and stops when exhausted',
    () async {
      final offsets = <String>[];
      final api = LiveDiscoveryApi(
        enabled: true,
        v2: LiveV2Api(
          sessions: DiscoverySessions(),
          client: MockClient((request) async {
            final offset = request.url.queryParameters['offset']!;
            offsets.add(offset);
            return http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'sessions': [
                    session,
                    if (offset != '0') {...session, 'id': 'second'},
                  ],
                  'nextOffset': offset == '0' ? 1 : null,
                },
              }),
              200,
            );
          }),
        ),
      );
      final feed = LiveDiscoveryFeed(api);
      await feed.load();
      await Future.wait([feed.load(more: true), feed.load(more: true)]);
      expect(feed.sessions.map((s) => s.id), ['live', 'second']);
      expect(offsets, ['0', '1']);
      await feed.load(more: true);
      expect(offsets, ['0', '1']);
      await feed.load();
      expect(feed.sessions.length, 1);
      api.close();
    },
  );
  test('feed preserves page and retry offset when load more fails', () async {
    var fail = true;
    final api = LiveDiscoveryApi(
      enabled: true,
      v2: LiveV2Api(
        sessions: DiscoverySessions(),
        client: MockClient((request) async {
          final offset = request.url.queryParameters['offset'];
          if (offset == '1' && fail) return http.Response('{}', 503);
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'sessions': [session],
                'nextOffset': offset == '0' ? 1 : null,
              },
            }),
            200,
          );
        }),
      ),
    );
    final feed = LiveDiscoveryFeed(api);
    await feed.load();
    await expectLater(feed.load(more: true), throwsA(isA<LiveApiException>()));
    expect(feed.sessions.single.id, 'live');
    expect(feed.nextOffset, 1);
    expect(feed.busy, false);
    fail = false;
    await feed.load(more: true);
    expect(feed.nextOffset, null);
    api.close();
  });
}
