import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/core/notifications/notification_device_api.dart';
import 'package:astro_soul_path/core/notifications/notification_session_fence.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/secure_logout.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/subscription/presentation/widgets/horoscope_subscription_status.dart';
import 'package:astro_soul_path/features/subscription/data/subscription_api.dart';

class TestSession extends AuthSessionStore {
  TestSession(this.pending);
  final Future<StoredAuthSession?> pending;
  @override
  Future<StoredAuthSession?> read() => pending;
}

void main() {
  setUp(NotificationSessionFence.activate);
  test(
    'failed unbinding still clears application auth and attempts every provider logout',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final operations = <String>[];
      await expectLater(
        secureLogout(
          AuthSessionStore(),
          unbindNotifications: () async {
            operations.add('unbind');
            throw StateError('synthetic-failure');
          },
          signOutFirebase: () async {
            operations.add('firebase');
          },
          signOutGoogle: () async {
            operations.add('google');
          },
          signOutLegacy: () async {
            operations.add('legacy');
          },
        ),
        throwsStateError,
      );
      expect(operations, ['unbind', 'firebase', 'google', 'legacy']);
      expect(NotificationSessionFence.suspended, true);
    },
  );
  const session = StoredAuthSession(
    accessToken: 'synthetic-access',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': 'A'},
    expiresIn: 3600,
  );
  test(
    'unregister sends exact token with captured owner authorization and no user override',
    () async {
      final api = NotificationDeviceApi(
        client: MockClient((request) async {
          expect(request.url.path, '/notifications/devices/unregister');
          expect(request.headers['Authorization'], 'Bearer synthetic-access');
          expect(jsonDecode(request.body), {'fcmToken': 'synthetic-token'});
          return http.Response('{"success":true}', 200);
        }),
      );
      await api.unregisterDevice(
        fcmToken: 'synthetic-token',
        accessToken: 'synthetic-access',
      );
      api.close();
    },
  );
  test(
    'logout during session resolution fences pending registration',
    () async {
      final pending = Completer<StoredAuthSession?>();
      var sent = 0;
      final api = NotificationDeviceApi(
        sessionStore: TestSession(pending.future),
        client: MockClient((_) async {
          sent++;
          return http.Response('{}', 200);
        }),
      );
      final operation = api.registerDevice(fcmToken: 'synthetic');
      NotificationSessionFence.suspend();
      pending.complete(session);
      await operation;
      expect(sent, 0);
      api.close();
    },
  );
  test(
    'account switch invalidates prior generation and permits new registration',
    () async {
      final pending = Completer<StoredAuthSession?>();
      var sent = 0;
      final api = NotificationDeviceApi(
        sessionStore: TestSession(pending.future),
        client: MockClient((_) async {
          sent++;
          return http.Response('{}', 200);
        }),
      );
      final old = api.registerDevice(fcmToken: 'synthetic');
      NotificationSessionFence.activate();
      pending.complete(session);
      await old;
      expect(sent, 0);
      await api.registerDevice(fcmToken: 'synthetic');
      expect(sent, 1);
      api.close();
    },
  );
  test(
    'subscription cancellation cannot use another account after a session switch',
    () async {
      var sent = 0;
      final api = SubscriptionApi(
        sessionStore: TestSession(Future.value(session)),
        client: MockClient((_) async {
          sent++;
          return http.Response('{}', 200);
        }),
      );
      await expectLater(
        api.cancelAtPeriodEnd(expectedUserId: 'different-owner'),
        throwsA(isA<SubscriptionApiException>()),
      );
      expect(sent, 0);
      api.close();
    },
  );
  Map<String, dynamic> data({
    String status = 'ACTIVE',
    bool supported = false,
    bool cancelled = false,
  }) => {
    'subscriptionStatus': status,
    'endDate': '2099-01-01T00:00:00Z',
    'subscriptionPlan': {'name': 'DAILY_HOROSCOPE_MONTHLY'},
    'billing': {
      'renewalMode': 'MANUAL',
      'cancelAtPeriodEnd': cancelled,
      'periodEndCancellationSupported': supported,
    },
  };
  Future<void> mount(
    WidgetTester tester,
    Future<Map<String, dynamic>?> Function() load, {
    Future<void> Function()? cancel,
  }) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: HoroscopeSubscriptionStatus(load: load, cancel: cancel),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'active plan shows expiry/manual mode without inventing refund status',
    (tester) async {
      await mount(tester, () async => data());
      expect(find.text('Status: ACTIVE'), findsOneWidget);
      expect(find.textContaining('2099'), findsOneWidget);
      expect(find.textContaining('Manual renewal'), findsOneWidget);
      expect(find.textContaining('Refund status: unavailable'), findsOneWidget);
      expect(find.text('Cancel at period end'), findsNothing);
    },
  );
  testWidgets(
    'backend-supported period-end cancellation requires explicit confirmation',
    (tester) async {
      var calls = 0;
      await mount(
        tester,
        () async => data(supported: true),
        cancel: () async {
          calls++;
        },
      );
      await tester.tap(find.text('Cancel at period end'));
      await tester.pumpAndSettle();
      expect(calls, 0);
      await tester.tap(find.text('Confirm cancellation'));
      await tester.pumpAndSettle();
      expect(calls, 1);
    },
  );
  testWidgets('pending payment is not presented as active access', (
    tester,
  ) async {
    await mount(tester, () async => data(status: 'PENDING'));
    expect(find.textContaining('Payment is not confirmed'), findsOneWidget);
    expect(find.text('Cancel at period end'), findsNothing);
  });
  testWidgets('read failure never fabricates subscription or refund outcome', (
    tester,
  ) async {
    await mount(tester, () async => throw StateError('private'));
    expect(find.textContaining('status unavailable'), findsOneWidget);
    expect(find.text('Status: ACTIVE'), findsNothing);
    expect(find.textContaining('private'), findsNothing);
  });
}
