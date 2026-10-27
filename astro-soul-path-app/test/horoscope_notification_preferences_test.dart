import 'dart:async';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/core/notifications/horoscope_notification_preferences.dart';
import 'package:astro_soul_path/features/notifications/presentation/widgets/horoscope_reminder_tile.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'preference starts unavailable before rollout without fabricating consent',
    () async {
      final api = HoroscopeNotificationPreferences(
        tokenLoader: () async => 'synthetic',
        client: MockClient((r) async {
          expect(r.method, 'GET');
          expect(r.url.path, '/notifications/horoscope-preference');
          return http.Response(
            '{"success":true,"data":{"enabled":false,"status":"NOT_ACTIVATED"}}',
            200,
          );
        }),
      );
      final result = await api.load();
      expect(result.available, false);
      expect(result.enabled, false);
      api.close();
    },
  );
  test(
    'only explicit boolean consent is sent; no user identity or language override',
    () async {
      final api = HoroscopeNotificationPreferences(
        tokenLoader: () async => 'synthetic',
        client: MockClient((r) async {
          expect(r.method, 'PATCH');
          expect(jsonDecode(r.body), {'enabled': true});
          expect(r.headers['Authorization'], 'Bearer synthetic');
          return http.Response('{"success":true,"data":{"enabled":true}}', 200);
        }),
      );
      expect((await api.save(true)).enabled, true);
      api.close();
    },
  );
  test('missing session never sends a preference mutation', () async {
    final api = HoroscopeNotificationPreferences(
      tokenLoader: () async => null,
      client: MockClient((_) async => throw StateError('Unexpected request')),
    );
    await expectLater(api.save(true), throwsStateError);
    api.close();
  });
  test(
    'server errors remain sanitized and cannot confirm saved consent',
    () async {
      final api = HoroscopeNotificationPreferences(
        tokenLoader: () async => 'synthetic',
        client: MockClient(
          (_) async => http.Response('private-server-detail', 403),
        ),
      );
      await expectLater(
        api.save(true),
        throwsA(
          isA<StateError>().having(
            (e) => e.message,
            'safe message',
            isNot(contains('private-server-detail')),
          ),
        ),
      );
      api.close();
    },
  );
  Future<void> mount(
    WidgetTester tester, {
    required bool granted,
    required List<bool> saves,
    bool enabled = false,
    bool available = true,
    VoidCallback? openSubscription,
    bool eligible = true,
    bool deliveryReady = true,
    String subscriptionStatus = "ACTIVE",
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: Scaffold(
          body: HoroscopeReminderTile(
            load: () async => HoroscopeNotificationPreference(
              enabled: enabled,
              available: available,
              eligible: eligible,
              deliveryReady: deliveryReady,
              subscriptionStatus: subscriptionStatus,
            ),
            permission: () async => granted,
            openSubscription: openSubscription,
            authorize: () async => granted,
            save: (value) async {
              saves.add(value);
              return HoroscopeNotificationPreference(
                enabled: value,
                available: true,
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  test('account switching discards a late preference response', () async {
    final pending = Completer<http.Response>();
    final api = HoroscopeNotificationPreferences(
      tokenLoader: () async => 'synthetic',
      client: MockClient((_) => pending.future),
    );
    final result = api.load();
    await Future<void>.delayed(Duration.zero);
    await AuthSessionStore().clear();
    pending.complete(
      http.Response(
        '{"success":true,"data":{"enabled":true,"eligible":true}}',
        200,
      ),
    );
    await expectLater(result, throwsStateError);
    api.close();
  });
  for (final state in ['ACTIVE', 'EXPIRED', 'NONE']) {
    testWidgets('authoritative reminder state: $state', (tester) async {
      await mount(
        tester,
        granted: true,
        saves: [],
        enabled: true,
        eligible: state == 'ACTIVE',
        subscriptionStatus: state,
      );
      expect(
        find.text(
          state == 'ACTIVE'
              ? 'Daily Horoscope Reminders Active'
              : state == 'EXPIRED'
              ? 'Renew Horoscope Subscription'
              : 'Unlock Daily Horoscope',
        ),
        findsOneWidget,
      );
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
        state == 'ACTIVE',
      );
    });
  }
  testWidgets('paused delivery is never labelled Active', (tester) async {
    await mount(
      tester,
      granted: true,
      saves: [],
      enabled: true,
      deliveryReady: false,
    );
    expect(find.text('Daily Horoscope Reminders Paused'), findsOneWidget);
    expect(find.text('Daily Horoscope Reminders Active'), findsNothing);
  });
  testWidgets('saved opt-out restores Off instead of activating on load', (
    tester,
  ) async {
    final saves = <bool>[];
    await mount(tester, granted: true, saves: saves);
    expect(find.text('Daily Horoscope Reminders Off'), findsOneWidget);
    expect(saves, isEmpty);
  });
  testWidgets('denied OS permission never opts customer in', (tester) async {
    final saves = <bool>[];
    await mount(tester, granted: false, saves: saves);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(saves, isEmpty);
    expect(find.textContaining('Allow notifications'), findsOneWidget);
  });
  testWidgets('granted permission saves explicit opt in', (tester) async {
    final saves = <bool>[];
    await mount(tester, granted: true, saves: saves);
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(saves, [true]);
  });
  testWidgets('opt out does not require OS permission', (tester) async {
    final saves = <bool>[];
    await mount(tester, granted: false, saves: saves, enabled: true);
    await tester.tap(find.text('Turn reminders off'));
    await tester.pumpAndSettle();
    expect(saves, [false]);
  });
  testWidgets(
    'unavailable rollout stays disabled at narrow width and large text',
    (tester) async {
      tester.view.resetPhysicalSize();
      tester.view.physicalSize = const Size(320, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final saves = <bool>[];
      await mount(tester, granted: true, saves: saves, available: false);
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
        isNull,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('idle logout clears the displayed reminder state', (
    tester,
  ) async {
    await mount(tester, granted: true, saves: [], enabled: true);
    expect(find.text('Daily Horoscope Reminders Active'), findsOneWidget);
    await tester.runAsync(() => AuthSessionStore().clear());
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Daily Horoscope Reminders Active'), findsNothing);
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
      isNull,
    );
  });
  testWidgets('subscription expiry refreshes an open reminder tile', (
    tester,
  ) async {
    var reads = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HoroscopeReminderTile(
            permission: () async => true,
            load: () async {
              reads++;
              return HoroscopeNotificationPreference(
                enabled: true,
                available: true,
                eligible: reads == 1,
                subscriptionStatus: reads == 1 ? 'ACTIVE' : 'EXPIRED',
                expiresAt: reads == 1
                    ? DateTime.now().add(const Duration(seconds: 1))
                    : null,
              );
            },
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Daily Horoscope Reminders Active'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.text('Renew Horoscope Subscription'), findsOneWidget);
    expect(reads, 2);
  });
  testWidgets(
    'blocked switch tap explains server activation without saving consent',
    (tester) async {
      final saves = <bool>[];
      await mount(tester, granted: true, saves: saves, available: false);
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('Why reminders are unavailable'), findsOneWidget);
      expect(
        find.textContaining('required database migration'),
        findsOneWidget,
      );
      expect(find.textContaining('another payment'), findsOneWidget);
      expect(saves, isEmpty);
    },
  );
  testWidgets('missing subscription offers existing subscription navigation', (
    tester,
  ) async {
    var opens = 0;
    await mount(
      tester,
      granted: true,
      saves: [],
      eligible: false,
      subscriptionStatus: 'NONE',
      openSubscription: () => opens++,
    );
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View Horoscope subscription'));
    await tester.pumpAndSettle();
    expect(opens, 1);
  });
  testWidgets('unknown eligibility never offers another purchase', (
    tester,
  ) async {
    await mount(
      tester,
      granted: true,
      saves: [],
      eligible: false,
      subscriptionStatus: 'UNKNOWN',
    );
    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();
    expect(find.text('View Horoscope subscription'), findsNothing);
    expect(find.textContaining('do not purchase again'), findsOneWidget);
  });
  testWidgets(
    'blocked dialog rechecks authoritative status without a mutation',
    (tester) async {
      var loads = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: HoroscopeReminderTile(
              permission: () async => true,
              load: () async {
                loads++;
                return HoroscopeNotificationPreference(
                  enabled: false,
                  available: loads > 1,
                );
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Check status again'));
      await tester.pumpAndSettle();
      expect(loads, 2);
      expect(find.text('Daily Horoscope Reminders Off'), findsOneWidget);
      expect(
        tester.widget<SwitchListTile>(find.byType(SwitchListTile)).onChanged,
        isNotNull,
      );
    },
  );
}
