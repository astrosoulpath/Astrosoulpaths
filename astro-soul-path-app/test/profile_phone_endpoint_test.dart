import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';

class Sessions extends AuthSessionStore {
  Sessions(this.provider);
  final String provider;
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'bearer-proof',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: 'OPEN_HOME',
    user: {'id': 'canonical'},
    expiresIn: 3600,
    authProvider: provider,
  );
}

void main() {
  for (final provider in ['firebase', 'asp-context', 'supabase']) {
    test('$provider selects correct endpoint and proof', () async {
      final api = ProfileApi(
        sessionStore: Sessions(provider),
        client: MockClient((request) async {
          expect(
            request.url.path,
            provider != 'supabase'
                ? '/user/profile/phone/firebase-attach'
                : '/user/profile/phone/firebase-verify',
          );
          expect(request.headers['Authorization'], 'Bearer bearer-proof');
          expect(
            jsonDecode(request.body),
            provider != 'supabase'
                ? {'firebaseIdToken': 'otp-proof'}
                : {'firebaseIdToken': 'otp-proof', 'confirmAccountLink': false},
          );
          return http.Response('{"success":true}', 200);
        }),
      );
      addTearDown(api.close);
      await api.verifyFirebaseProfilePhone(firebaseIdToken: 'otp-proof');
    });
  }
  test(
    'Firebase foreign ownership refusal remains an error without fallback',
    () async {
      var calls = 0;
      final api = ProfileApi(
        sessionStore: Sessions('firebase'),
        client: MockClient((request) async {
          calls++;
          return http.Response(
            '{"success":false,"code":"PHONE_ACCOUNT_OWNERSHIP_REQUIRED","message":"Recovery required"}',
            409,
          );
        }),
      );
      addTearDown(api.close);
      await expectLater(
        api.verifyFirebaseProfilePhone(firebaseIdToken: 'otp-proof'),
        throwsA(
          isA<ProfileApiException>().having(
            (e) => e.code,
            'code',
            'PHONE_ACCOUNT_OWNERSHIP_REQUIRED',
          ),
        ),
      );
      expect(calls, 1);
    },
  );
  test(
    'Firebase explicit linking cannot enter legacy merge endpoint',
    () async {
      final api = ProfileApi(
        sessionStore: Sessions('firebase'),
        client: MockClient((_) async => throw StateError('must not request')),
      );
      addTearDown(api.close);
      await expectLater(
        api.verifyFirebaseProfilePhone(
          firebaseIdToken: 'otp-proof',
          confirmAccountLink: true,
        ),
        throwsA(isA<ProfileApiException>()),
      );
    },
  );
  test('Supabase explicit consent retains legacy payload', () async {
    final api = ProfileApi(
      sessionStore: Sessions('supabase'),
      client: MockClient((r) async {
        expect(r.url.path, '/user/profile/phone/firebase-verify');
        expect(jsonDecode(r.body)['confirmAccountLink'], true);
        return http.Response('{"success":true}', 200);
      }),
    );
    addTearDown(api.close);
    await api.verifyFirebaseProfilePhone(
      firebaseIdToken: 'otp-proof',
      confirmAccountLink: true,
    );
  });
  for (final identity in ['canonical', 'foreign']) {
    test(
      'verified phone refresh enforces canonical identity: $identity',
      () async {
        final api = ProfileApi(
          sessionStore: Sessions('firebase'),
          client: MockClient((request) async {
            expect(request.url.path, '/user/session');
            return http.Response(
              jsonEncode({
                'success': true,
                'user': {
                  'id': identity,
                  'phone': '+919876543210',
                  'isPhoneVerified': true,
                },
              }),
              200,
            );
          }),
        );
        addTearDown(api.close);
        if (identity == 'canonical') {
          final state = await api.refreshVerifiedPhone();
          expect(state['canonicalUserId'], 'canonical');
          expect(state['phone'], '+919876543210');
        } else {
          await expectLater(
            api.refreshVerifiedPhone(),
            throwsA(isA<ProfileApiException>()),
          );
        }
      },
    );
  }
}
