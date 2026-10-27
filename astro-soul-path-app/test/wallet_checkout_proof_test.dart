import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_api.dart';

class ProofSession extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic-context',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: 'OPEN_HOME',
    user: {'id': 'synthetic'},
    expiresIn: 3600,
    authProvider: 'asp-context',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  final signature = 'a' * 64;
  for (final config in [
    {'keyId': 'not-a-provider-key', 'mode': 'TEST'},
    {'keyId': 'rzp_live_synthetic', 'mode': 'TEST'},
  ]) {
    test(
      'native checkout rejects malformed or mismatched public configuration $config',
      () async {
        final api = WalletApi(
          sessionStore: ProofSession(),
          client: MockClient(
            (_) async => http.Response(
              jsonEncode({'success': true, 'data': config}),
              200,
            ),
          ),
        );
        await expectLater(
          api.getRazorpayPublicKeyId(),
          throwsA(isA<WalletApiException>()),
        );
      },
    );
  }
  test(
    'native public config remains compatible with prior key-only response',
    () async {
      final api = WalletApi(
        sessionStore: ProofSession(),
        client: MockClient(
          (_) async => http.Response(
            '{"success":true,"data":{"keyId":"rzp_test_synthetic"}}',
            200,
          ),
        ),
      );
      expect(await api.getRazorpayPublicKeyId(), 'rzp_test_synthetic');
    },
  );
  test(
    'sends SDK proof with the owned order to authenticated verification',
    () async {
      final api = WalletApi(
        sessionStore: ProofSession(),
        client: MockClient((r) async {
          expect(r.method, 'POST');
          expect(r.url.path, '/payments/verify-checkout');
          expect(r.headers['Authorization'], 'Bearer synthetic-context');
          expect(r.headers['Content-Type'], 'application/json');
          expect(jsonDecode(r.body), {
            'orderId': 'order_owned',
            'paymentId': 'pay_owned',
            'signature': signature,
          });
          return http.Response('{"success":true,"status":"SUCCESS"}', 200);
        }),
      );
      expect(
        (await api.verifyCheckout(
          expectedOrderId: 'order_owned',
          callbackOrderId: 'order_owned',
          paymentId: 'pay_owned',
          signature: signature,
        ))['status'],
        'SUCCESS',
      );
    },
  );
  for (final callback in ['order_other', null]) {
    test(
      'rejects unowned/missing callback order $callback without network',
      () async {
        var calls = 0;
        final api = WalletApi(
          sessionStore: ProofSession(),
          client: MockClient((_) async {
            calls++;
            return http.Response('{}', 200);
          }),
        );
        await expectLater(
          api.verifyCheckout(
            expectedOrderId: 'order_owned',
            callbackOrderId: callback,
            paymentId: 'pay_owned',
            signature: signature,
          ),
          throwsA(isA<WalletApiException>()),
        );
        expect(calls, 0);
      },
    );
  }
  for (final badProof in [null, '', 'not-hex']) {
    test(
      'rejects missing/malformed signature $badProof without fulfillment request',
      () async {
        var calls = 0;
        final api = WalletApi(
          sessionStore: ProofSession(),
          client: MockClient((_) async {
            calls++;
            return http.Response('{}', 200);
          }),
        );
        await expectLater(
          api.verifyCheckout(
            expectedOrderId: 'order_owned',
            callbackOrderId: 'order_owned',
            paymentId: 'pay_owned',
            signature: badProof,
          ),
          throwsA(isA<WalletApiException>()),
        );
        expect(calls, 0);
      },
    );
  }
  test(
    'does not retry or fall back to reconciliation after server rejects signature',
    () async {
      var calls = 0;
      final api = WalletApi(
        sessionStore: ProofSession(),
        client: MockClient((_) async {
          calls++;
          return http.Response('{"message":"Invalid checkout signature"}', 400);
        }),
      );
      await expectLater(
        api.verifyCheckout(
          expectedOrderId: 'order_owned',
          callbackOrderId: 'order_owned',
          paymentId: 'pay_owned',
          signature: signature,
        ),
        throwsA(isA<WalletApiException>()),
      );
      expect(calls, 1);
    },
  );
  test(
    'interrupted checkout retains independent server reconciliation',
    () async {
      final api = WalletApi(
        sessionStore: ProofSession(),
        client: MockClient((r) async {
          expect(r.url.path, '/payments/reconcile/order_owned');
          return http.Response('{"success":true,"status":"PENDING"}', 200);
        }),
      );
      expect((await api.reconcileOrder('order_owned'))['status'], 'PENDING');
    },
  );
}
