import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/kundli/data/astrologer_manual_kundli_report_api.dart';
import 'package:astro_soul_path/features/kundli/presentation/screens/astrologer_manual_kundli_reports_screen.dart';

class _Session extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => const StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'ASTROLOGER',
    portal: 'astrologer',
    nextStep: 'OPEN_ASTROLOGER_DASHBOARD',
    user: {},
    expiresIn: 3600,
  );
}

void main() {
  for (final status in [401, 403]) {
    test(
      'report access denial retains HTTP $status even for a non-JSON error',
      () async {
        final api = AstrologerManualKundliReportApi(
          sessionStore: _Session(),
          client: MockClient((_) async => http.Response('Denied', status)),
        );
        await expectLater(
          api.getAstrologerReports(),
          throwsA(
            isA<AstrologerManualKundliReportApiException>().having(
              (e) => e.accessDenied,
              'denied',
              true,
            ),
          ),
        );
        api.close();
      },
    );
  }
  test(
    'failed 200 cannot masquerade as a successful empty report list',
    () async {
      final api = AstrologerManualKundliReportApi(
        sessionStore: _Session(),
        client: MockClient(
          (_) async => http.Response('{"success":false,"data":[]}', 200),
        ),
      );
      await expectLater(
        api.getAstrologerReports(),
        throwsA(isA<AstrologerManualKundliReportApiException>()),
      );
      api.close();
    },
  );
  for (final status in [403, 503]) {
    testWidgets(
      'failed refresh $status hides previously loaded reports without clearing the login',
      (tester) async {
        var calls = 0;
        final api = AstrologerManualKundliReportApi(
          sessionStore: _Session(),
          client: MockClient((request) async {
            expect(request.headers['Authorization'], 'Bearer synthetic');
            calls++;
            return calls == 1
                ? http.Response(
                    jsonEncode({
                      'success': true,
                      'data': [
                        {
                          'id': 'synthetic',
                          'callSessionId': 'synthetic',
                          'customerUserId': 'synthetic-customer',
                          'astrologerId': 'synthetic-owner',
                          'status': 'DRAFT',
                          'title': 'Previously authorized report',
                        },
                      ],
                    }),
                    200,
                  )
                : http.Response(
                    '{"message":"Report access unavailable"}',
                    status,
                  );
          }),
        );
        await tester.pumpWidget(
          MaterialApp(home: AstrologerManualKundliReportsScreen(api: api)),
        );
        await tester.pumpAndSettle();
        expect(find.text('Previously authorized report'), findsOneWidget);
        await tester.tap(find.byTooltip('Refresh'));
        await tester.pumpAndSettle();
        expect(find.text('Previously authorized report'), findsNothing);
        expect(find.text('Report access unavailable'), findsOneWidget);
        expect(calls, 2);
      },
    );
  }
}
