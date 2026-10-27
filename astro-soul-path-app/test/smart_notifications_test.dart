import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/core/notifications/notification_session_fence.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/notifications/data/notifications_api.dart';
import 'package:astro_soul_path/features/notifications/presentation/screens/notification_reading_screen.dart';

class _Sessions extends AuthSessionStore {
  String id = 'owner';
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': id},
    expiresIn: 3600,
  );
}

class _Expired extends NotificationsApi {
  @override
  Future<Map<String, dynamic>> getReading(String id) async =>
      throw const NotificationsApiException('expired');
}

class _Ready extends NotificationsApi {
  @override
  Future<Map<String, dynamic>> getReading(String id) async => {
    'id': id,
    'title': 'Owned reading',
    'body': 'Private reflection',
    'advice': 'Reflect',
    'date': '2026-10-17',
    'locale': 'en',
  };
}

class _SmartReady extends NotificationsApi {
  final requests = <String>[];
  @override
  Future<void> markInsightOpened(String id) async {}
  @override
  Future<Map<String, dynamic>> getInsight(String id) async {
    requests.add(id);
    return {
      'id': id,
      'title': 'Career insight',
      'body': 'General editorial reflection',
      'locale': 'en',
      'date': '2026-10-17',
      'source': 'ADMIN_EDITORIAL',
      'interpretationNotice':
          'General editorial guidance, not a personalized chart finding.',
    };
  }
}

class _ArabicReady extends _SmartReady {
  @override
  Future<Map<String, dynamic>> getInsight(String id) async => {
    'id': id,
    'title': 'الحب والعلاقات',
    'body': 'عوامل محسوبة من خريطة الميلاد',
    'locale': 'ar',
    'date': '2026-10-17',
    'interpretationNotice': 'ليس تنبؤًا',
  };
}

class _StaleSmart extends _SmartReady {
  _StaleSmart(this.expiry);
  final String expiry;
  @override
  Future<Map<String, dynamic>> getInsight(String id) async => {
    ...await super.getInsight(id),
    'expiresAt': expiry,
  };
}

class _MutableExpiry extends _SmartReady {
  Map<String, dynamic>? displayed;
  @override
  Future<Map<String, dynamic>> getInsight(String id) async {
    displayed = {
      ...await super.getInsight(id),
      'expiresAt': DateTime.now()
          .add(const Duration(days: 1))
          .toIso8601String(),
    };
    return displayed!;
  }
}

void main() {
  testWidgets(
    'expiry watcher clears content and remains active on a reused route',
    (tester) async {
      NotificationSessionFence.activate();
      final api = _MutableExpiry();
      Widget route(String id) => MaterialApp(
        home: NotificationReadingScreen(
          key: const ValueKey('expiry-route'),
          readingId: id,
          smartInsight: true,
          api: api,
        ),
      );
      await tester.pumpWidget(route('12345678-1234-4234-8234-123456789abc'));
      await tester.pumpAndSettle();
      expect(find.text('Career insight'), findsOneWidget);
      api.displayed!['expiresAt'] = '2000-01-01T00:00:00Z';
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Career insight'), findsNothing);
      await tester.pumpWidget(route('12345678-1234-4234-8234-123456789abd'));
      await tester.pumpAndSettle();
      expect(find.text('Career insight'), findsOneWidget);
      api.displayed!['expiresAt'] = '2000-01-01T00:00:00Z';
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Career insight'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final expiry in ['2000-01-01T00:00:00Z', 'invalid']) {
    testWidgets(
      'expired or malformed server expiry never displays private content: $expiry',
      (tester) async {
        NotificationSessionFence.activate();
        await tester.pumpWidget(
          MaterialApp(
            home: NotificationReadingScreen(
              readingId: '12345678-1234-4234-8234-123456789abc',
              smartInsight: true,
              api: _StaleSmart(expiry),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Career insight'), findsNothing);
        expect(
          find.text(
            'This reading is unavailable, expired or no longer authorized.',
          ),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
  testWidgets('reused detail route reloads the exact new insight', (
    tester,
  ) async {
    NotificationSessionFence.activate();
    final api = _SmartReady();
    const first = '12345678-1234-4234-8234-123456789abc';
    const second = '12345678-1234-4234-8234-123456789abd';
    await tester.pumpWidget(
      MaterialApp(
        home: NotificationReadingScreen(
          key: const ValueKey('detail'),
          readingId: first,
          smartInsight: true,
          api: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.pumpWidget(
      MaterialApp(
        home: NotificationReadingScreen(
          key: const ValueKey('detail'),
          readingId: second,
          smartInsight: true,
          api: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Career insight'), findsOneWidget);
    expect(api.requests, [first, second]);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'Arabic authorized detail retains Unicode and right-to-left layout',
    (tester) async {
      NotificationSessionFence.activate();
      await tester.pumpWidget(
        MaterialApp(
          home: NotificationReadingScreen(
            readingId: '12345678-1234-4234-8234-123456789abc',
            smartInsight: true,
            api: _ArabicReady(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('الحب والعلاقات'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.text('الحب والعلاقات'))),
        TextDirection.rtl,
      );
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final locale in [
    'en',
    'hi',
    'bn',
    'ta',
    'te',
    'mr',
    'gu',
    'kn',
    'ml',
    'pa',
    'es',
    'fr',
    'de',
    'pt',
    'it',
    'ja',
    'ko',
    'zh',
    'ar',
    'ru',
  ]) {
    test(
      'exact insight transport preserves saved payload locale $locale',
      () async {
        const id = '12345678-1234-4234-8234-123456789abc';
        final api = NotificationsApi(
          sessionStore: _Sessions(),
          client: MockClient(
            (request) async => http.Response(
              jsonEncode({
                'success': true,
                'data': {
                  'id': id,
                  'locale': locale,
                  'title': 'नमस्ते · مرحبًا · 你好',
                  'body': 'Unicode ✓',
                },
              }),
              200,
              headers: {'content-type': 'application/json; charset=utf-8'},
            ),
          ),
        );
        final result = await api.getInsight(id);
        expect(result['locale'], locale);
        expect(result['title'], 'नमस्ते · مرحبًا · 你好');
        api.close();
      },
    );
  }
  testWidgets('smart detail uses exact insight API and clears on logout', (
    tester,
  ) async {
    NotificationSessionFence.activate();
    await tester.pumpWidget(
      MaterialApp(
        home: NotificationReadingScreen(
          readingId: '12345678-1234-4234-8234-123456789abc',
          smartInsight: true,
          api: _SmartReady(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Career insight'), findsOneWidget);
    NotificationSessionFence.suspend();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Career insight'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  test('smart insight rejects invalid id without transport', () async {
    var calls = 0;
    final api = NotificationsApi(
      sessionStore: _Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.getInsight('../other'),
      throwsA(isA<NotificationsApiException>()),
    );
    expect(calls, 0);
    api.close();
  });
  test(
    'smart insight uses exact owner-fenced endpoint and rejects mismatched content',
    () async {
      const insight = '12345678-1234-4234-8234-123456789abc';
      final sessions = _Sessions();
      final api = NotificationsApi(
        sessionStore: sessions,
        client: MockClient((request) async {
          expect(request.url.path, '/notifications/insights/$insight');
          expect(request.headers['Authorization'], 'Bearer synthetic');
          sessions.id = 'other';
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'id': insight, 'title': 'Private', 'body': 'Private'},
            }),
            200,
          );
        }),
      );
      await expectLater(
        api.getInsight(insight),
        throwsA(isA<NotificationsApiException>()),
      );
      api.close();
    },
  );
  testWidgets(
    'logout clears already displayed reading within the local identity check',
    (tester) async {
      NotificationSessionFence.activate();
      await tester.pumpWidget(
        MaterialApp(
          home: NotificationReadingScreen(readingId: 'a' * 64, api: _Ready()),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Private reflection'), findsOneWidget);
      NotificationSessionFence.suspend();
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.text('Private reflection'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  setUp(NotificationSessionFence.activate);
  final id = 'a' * 64;
  test(
    'exact reading uses only validated id and bearer authorization',
    () async {
      final api = NotificationsApi(
        sessionStore: _Sessions(),
        client: MockClient((request) async {
          expect(request.url.path, '/notifications/readings/$id');
          expect(request.headers['Authorization'], 'Bearer synthetic');
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'id': id, 'title': 'Daily reflection'},
            }),
            200,
          );
        }),
      );
      expect((await api.getReading(id))['title'], 'Daily reflection');
      api.close();
    },
  );
  test('invalid reading id never reaches transport', () async {
    var calls = 0;
    final api = NotificationsApi(
      sessionStore: _Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.getReading('../other'),
      throwsA(isA<NotificationsApiException>()),
    );
    expect(calls, 0);
    api.close();
  });
  test('late old-account inbox response is discarded', () async {
    final sessions = _Sessions();
    final api = NotificationsApi(
      sessionStore: sessions,
      client: MockClient((_) async {
        sessions.id = 'other';
        return http.Response(
          '{"success":true,"data":{"items":[],"unreadCount":0}}',
          200,
        );
      }),
    );
    await expectLater(
      api.getNotifications(),
      throwsA(isA<NotificationsApiException>()),
    );
    api.close();
  });
  test('logout generation invalidates an in-flight reading', () async {
    final api = NotificationsApi(
      sessionStore: _Sessions(),
      client: MockClient((_) async {
        NotificationSessionFence.suspend();
        return http.Response(
          jsonEncode({
            'success': true,
            'data': {'id': id},
          }),
          200,
        );
      }),
    );
    await expectLater(
      api.getReading(id),
      throwsA(isA<NotificationsApiException>()),
    );
    api.close();
  });
  testWidgets('expired content shows safe unavailable state with retry', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: NotificationReadingScreen(readingId: id, api: _Expired()),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text(
        'This reading is unavailable, expired or no longer authorized.',
      ),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
