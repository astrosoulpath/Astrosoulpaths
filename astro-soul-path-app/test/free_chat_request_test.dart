import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/customer/data/customer_consultation_api.dart';

class _Session extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => const StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: 'OPEN_CUSTOMER_DASHBOARD',
    user: {'id': 'customer'},
    expiresIn: 3600,
  );
}

void main() {
  for (final freeOnly in [true, false]) {
    test(
      'free-only intent $freeOnly reaches server without granting eligibility',
      () async {
        final client = MockClient((request) async {
          final payload = jsonDecode(request.body) as Map;
          expect(payload['astrologerUserId'], 'canonical-astrologer-user');
          expect(payload.containsKey('requireFreeChat'), freeOnly);
          if (freeOnly) expect(payload['requireFreeChat'], true);
          expect(payload.containsKey('isFreeChat'), false);
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {
                'call': {'id': 'persisted', 'status': 'PENDING'},
              },
            }),
            200,
          );
        });
        final api = CustomerConsultationApi(
          client: client,
          sessionStore: _Session(),
        );
        final result = await api.startConsultation(
          astrologerUserId: 'canonical-astrologer-user',
          purchasedMinutes: 1,
          mode: CustomerConsultationMode.chat,
          requireFreeChat: freeOnly,
        );
        expect(result.consultationId, 'persisted');
        expect(result.status, 'PENDING');
        api.close();
      },
    );
  }
  test('stale free entitlement rejection is not retried as paid', () async {
    var calls = 0;
    final api = CustomerConsultationApi(
      sessionStore: _Session(),
      client: MockClient((request) async {
        calls++;
        return http.Response(
          '{"success":false,"message":"Free chat is no longer available"}',
          403,
        );
      }),
    );
    await expectLater(
      api.startConsultation(
        astrologerUserId: 'canonical',
        purchasedMinutes: 1,
        mode: CustomerConsultationMode.chat,
        requireFreeChat: true,
      ),
      throwsA(isA<CustomerConsultationApiException>()),
    );
    expect(calls, 1);
    api.close();
  });
}
