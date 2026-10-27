import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/subscription/data/subscription_api.dart';
import 'package:astro_soul_path/features/wallet/data/pending_wallet_payment_store.dart';

class Sessions extends AuthSessionStore {
  String owner = 'synthetic';
  String context = 'customer';
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: context,
    nextStep: '',
    user: {'id': owner},
    expiresIn: 3600,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'subscription recovery is durable and separate from wallet recovery',
    () async {
      final sessions = Sessions();
      await PendingWalletPaymentStore(sessions: sessions).save('order_wallet');
      await PendingWalletPaymentStore(
        sessions: sessions,
        purpose: 'subscription',
      ).save('order_subscription');
      expect(
        await PendingWalletPaymentStore(
          sessions: sessions,
          purpose: 'subscription',
        ).read(),
        'order_subscription',
      );
      expect(
        await PendingWalletPaymentStore(sessions: sessions).read(),
        'order_wallet',
      );
    },
  );
  test(
    'subscription references cannot cross customer and astrologer contexts',
    () async {
      final sessions = Sessions();
      final customer = PendingWalletPaymentStore(
        sessions: sessions,
        purpose: 'subscription',
      );
      await customer.save('order_customer');
      sessions.context = 'astrologer';
      await expectLater(customer.read(), throwsStateError);
      expect(
        await PendingWalletPaymentStore(
          sessions: sessions,
          portal: 'astrologer',
          purpose: 'subscription',
        ).read(),
        isNull,
      );
    },
  );
  test(
    'late reconciliation response is rejected after account switch',
    () async {
      final sessions = Sessions();
      final started = Completer<void>();
      final response = Completer<http.Response>();
      final api = SubscriptionApi(
        sessionStore: sessions,
        client: MockClient((_) {
          started.complete();
          return response.future;
        }),
      );
      final result = api.reconcileOrder('order_synthetic');
      final rejected = expectLater(
        result,
        throwsA(isA<SubscriptionApiException>()),
      );
      await started.future;
      sessions.owner = 'different';
      response.complete(
        http.Response('{"success":true,"status":"SUCCESS"}', 200),
      );
      await rejected;
      api.close();
    },
  );
  test('malformed callback references never reach backend', () async {
    var calls = 0;
    final api = SubscriptionApi(
      sessionStore: Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.reconcileOrder('../foreign'),
      throwsA(isA<SubscriptionApiException>()),
    );
    expect(calls, 0);
    api.close();
  });
  test('pending provider reconciliation remains pending', () async {
    final api = SubscriptionApi(
      sessionStore: Sessions(),
      client: MockClient(
        (_) async => http.Response('{"success":true,"status":"PENDING"}', 200),
      ),
    );
    expect((await api.reconcileOrder('order_synthetic'))['status'], 'PENDING');
    api.close();
  });
  test('disposed API cannot make new authenticated requests', () async {
    var calls = 0;
    final api = SubscriptionApi(
      sessionStore: Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    api.close();
    await expectLater(
      api.reconcileOrder('order_synthetic'),
      throwsA(isA<SubscriptionApiException>()),
    );
    expect(calls, 0);
  });
  test('ADMIN context cannot initiate subscription checkout', () async {
    var calls = 0;
    final api = SubscriptionApi(
      sessionStore: Sessions()..context = 'admin',
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.createSubscriptionOrder('ASTROLOGER_KUNDLI_YEARLY'),
      throwsA(isA<SubscriptionApiException>()),
    );
    expect(calls, 0);
    api.close();
  });
}
