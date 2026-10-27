import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_api.dart';

class _Sessions extends AuthSessionStore {
  bool signedIn = true;
  @override
  Future<StoredAuthSession?> read() async => signedIn
      ? const StoredAuthSession(
          accessToken: 'synthetic',
          refreshToken: '',
          role: 'CUSTOMER',
          portal: 'customer',
          nextStep: '',
          user: {'id': 'synthetic'},
          expiresIn: 3600,
        )
      : null;
}

void main() {
  test(
    'wallet reconciliation preserves server PENDING rather than final success',
    () async {
      var calls = 0;
      final api = WalletApi(
        sessionStore: _Sessions(),
        client: MockClient((request) async {
          calls++;
          expect(request.method, 'POST');
          expect(request.url.path, '/payments/reconcile/synthetic-order');
          expect(request.headers['Authorization'], 'Bearer synthetic');
          return http.Response(
            '{"success":true,"status":"PENDING","reason":"gateway_payment_pending"}',
            200,
          );
        }),
      );
      expect(
        (await api.reconcileOrder('synthetic-order'))['status'],
        'PENDING',
      );
      expect(calls, 1);
      api.close();
    },
  );
  test(
    'rejected verification is never retried or represented as success',
    () async {
      var calls = 0;
      final api = WalletApi(
        sessionStore: _Sessions(),
        client: MockClient((_) async {
          calls++;
          return http.Response('{}', 401);
        }),
      );
      await expectLater(
        api.reconcileOrder('synthetic-order'),
        throwsA(isA<WalletApiException>()),
      );
      expect(calls, 1);
      api.close();
    },
  );
  test('signed-out customer cannot dispatch payment verification', () async {
    final sessions = _Sessions()..signedIn = false;
    var calls = 0;
    final api = WalletApi(
      sessionStore: sessions,
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.reconcileOrder('synthetic-order'),
      throwsA(isA<WalletApiException>()),
    );
    expect(calls, 0);
    api.close();
  });
}
