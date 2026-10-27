import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/subscription/data/subscription_api.dart';
import 'subscription_payment_recovery_test.dart' show Sessions;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final proof = 'a' * 64;
  test('subscription SDK proof uses authenticated HMAC route', () async {
    final api = SubscriptionApi(
      sessionStore: Sessions(),
      client: MockClient((r) async {
        expect(r.url.path, '/payments/verify-checkout');
        expect(r.headers['Authorization'], 'Bearer synthetic');
        expect(jsonDecode(r.body), {
          'orderId': 'order_owned',
          'paymentId': 'pay_owned',
          'signature': proof,
        });
        return http.Response('{"success":true,"status":"SUCCESS"}', 200);
      }),
    );
    expect(
      (await api.verifyCheckout(
        expectedOrderId: 'order_owned',
        callbackOrderId: 'order_owned',
        paymentId: 'pay_owned',
        signature: proof,
      ))['status'],
      'SUCCESS',
    );
    api.close();
  });
  for (final invalid in ['foreign', 'missing-signature']) {
    test(
      'invalid subscription proof $invalid never calls recovery or backend',
      () async {
        var calls = 0;
        final api = SubscriptionApi(
          sessionStore: Sessions(),
          client: MockClient((_) async {
            calls++;
            return http.Response('{}', 200);
          }),
        );
        await expectLater(
          api.verifyCheckout(
            expectedOrderId: 'order_owned',
            callbackOrderId: invalid == 'foreign'
                ? 'order_foreign'
                : 'order_owned',
            paymentId: 'pay_owned',
            signature: invalid == 'missing-signature' ? null : proof,
          ),
          throwsA(isA<SubscriptionApiException>()),
        );
        expect(calls, 0);
        api.close();
      },
    );
  }
  test(
    'account switch during checkout verification rejects previous success',
    () async {
      final sessions = Sessions();
      final api = SubscriptionApi(
        sessionStore: sessions,
        client: MockClient((_) async {
          sessions.owner = 'other';
          return http.Response('{"success":true,"status":"SUCCESS"}', 200);
        }),
      );
      await expectLater(
        api.verifyCheckout(
          expectedOrderId: 'order_owned',
          callbackOrderId: 'order_owned',
          paymentId: 'pay_owned',
          signature: proof,
        ),
        throwsA(isA<SubscriptionApiException>()),
      );
      api.close();
    },
  );
}
