import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/astrologer/data/astrologer_portal_api.dart';

void main() {
  for (final status in [401, 403]) {
    test(
      'access denial retains HTTP status $status for restricted UI',
      () async {
        final api = AstrologerPortalApi(
          client: MockClient((_) async => http.Response('{}', status)),
        );
        await expectLater(
          api.getDashboard(accessToken: 'synthetic'),
          throwsA(
            isA<AstrologerPortalApiException>()
                .having((e) => e.accessDenied, 'denied', true)
                .having((e) => e.statusCode, 'status', status),
          ),
        );
        api.close();
      },
    );
  }
  final valid = {
    'success': true,
    'data': {
      'userId': 'synthetic-user',
      'astrologerId': 'synthetic-profile',
      'isOnline': true,
      'isApproved': true,
      'isVerified': true,
      'earnings': '12.50',
      'pendingConsultations': 3,
    },
  };
  test('valid authenticated dashboard retains exact backend values', () async {
    final api = AstrologerPortalApi(
      client: MockClient((request) async {
        expect(request.url.path, '/astrologer/dashboard');
        expect(request.headers['Authorization'], 'Bearer synthetic');
        return http.Response(jsonEncode(valid), 200);
      }),
    );
    expect(await api.getDashboard(accessToken: 'synthetic'), valid);
    api.close();
  });
  for (final body in [
    '',
    '<html>Unavailable</html>',
    '{}',
    '{"success":false,"message":"Service unavailable"}',
    '{"success":true,"data":{}}',
    '{"success":true,"data":[]}',
  ]) {
    test(
      'malformed/failed 200 does not render an empty successful dashboard: $body',
      () async {
        final api = AstrologerPortalApi(
          client: MockClient((_) async => http.Response(body, 200)),
        );
        await expectLater(
          api.getDashboard(accessToken: 'synthetic'),
          throwsA(isA<AstrologerPortalApiException>()),
        );
        api.close();
      },
    );
  }
  test(
    'transport failure is sanitized into a retryable dashboard exception',
    () async {
      final api = AstrologerPortalApi(
        client: MockClient(
          (_) async => throw http.ClientException('PRIVATE_TRANSPORT_DETAILS'),
        ),
      );
      await expectLater(
        api.getDashboard(accessToken: 'synthetic'),
        throwsA(
          isA<AstrologerPortalApiException>().having(
            (e) => e.message,
            'sanitized',
            isNot(contains('PRIVATE_TRANSPORT_DETAILS')),
          ),
        ),
      );
      api.close();
    },
  );
  test(
    'status update rejects a failed 200 instead of confirming success',
    () async {
      final api = AstrologerPortalApi(
        client: MockClient((request) async {
          expect(jsonDecode(request.body), {'isOnline': false});
          return http.Response(
            '{"success":false,"message":"Approval required"}',
            200,
          );
        }),
      );
      await expectLater(
        api.updateStatus(accessToken: 'synthetic', isOnline: false),
        throwsA(isA<AstrologerPortalApiException>()),
      );
      api.close();
    },
  );
  test('missing authentication never sends a request', () async {
    final api = AstrologerPortalApi(
      client: MockClient((_) async => throw StateError('Unexpected network')),
    );
    await expectLater(
      api.getDashboard(accessToken: ''),
      throwsA(isA<AstrologerPortalApiException>()),
    );
    api.close();
  });
}
