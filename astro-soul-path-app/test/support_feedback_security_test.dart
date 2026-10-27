import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/support/data/support_api.dart';
import 'package:astro_soul_path/features/support/data/support_operations_config.dart';
import 'package:astro_soul_path/features/support/presentation/widgets/support_account_boundary.dart';
import 'package:astro_soul_path/features/feedback/data/feedback_api.dart';

class SyntheticSupportSession extends AuthSessionStore {
  SyntheticSupportSession(this.value);
  final Future<StoredAuthSession?> value;
  @override
  Future<StoredAuthSession?> read() => value;
}

const session = StoredAuthSession(
  accessToken: 'refreshed-synthetic',
  refreshToken: '',
  role: 'CUSTOMER',
  portal: 'customer',
  nextStep: '',
  user: {'id': 'A'},
  expiresIn: 3600,
);
void main() {
  test(
    'feedback association is explicit and history uses server pagination',
    () async {
      final api = FeedbackApi(
        sessionStore: SyntheticSupportSession(Future.value(session)),
        client: MockClient((request) async {
          if (request.method == 'POST') {
            expect(
              jsonDecode(request.body)['consultationId'],
              'synthetic-owned-call',
            );
            return http.Response('{"success":true}', 201);
          }
          expect(request.url.queryParameters['page'], '2');
          return http.Response('{"data":[]}', 200);
        }),
      );
      await api.submit(
        category: 'CONSULTATION',
        rating: 4,
        message: 'Synthetic feedback',
        consultationId: 'synthetic-owned-call',
      );
      expect(await api.getMine(page: 2), isEmpty);
      api.close();
    },
  );
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
  });
  test('new operations UI defaults disabled', () {
    expect(supportOperationsUiEnabled, isFalse);
  });
  test('tickets use fresh credentials and bounded server query', () async {
    final client = MockClient((request) async {
      expect(request.headers['Authorization'], 'Bearer refreshed-synthetic');
      expect(request.url.queryParameters, containsPair('page', '2'));
      expect(request.url.queryParameters, containsPair('search', 'wallet'));
      expect(request.url.queryParameters, containsPair('status', 'OPEN'));
      return http.Response('{"tickets":[]}', 200);
    });
    final api = SupportApi(
      accessToken: 'stale-synthetic',
      client: client,
      sessionStore: SyntheticSupportSession(Future.value(session)),
    );
    expect(
      await api.getMyTickets(page: 2, search: 'wallet', status: 'OPEN'),
      isEmpty,
    );
    api.close();
  });
  test(
    'AI health and Human tickets share the current Customer token, never Admin routes',
    () async {
      final paths = <String>[];
      final api = SupportApi(
        accessToken: 'obsolete-constructor-token',
        sessionStore: SyntheticSupportSession(Future.value(session)),
        client: MockClient((request) async {
          paths.add(request.url.path);
          expect(request.method, 'GET');
          expect(
            request.headers['Authorization'],
            'Bearer refreshed-synthetic',
          );
          expect(request.url.path, isNot(contains('/admin')));
          return http.Response(
            request.url.path.endsWith('/health')
                ? '{"provider":{"available":true}}'
                : '{"tickets":[]}',
            200,
          );
        }),
      );
      expect(await api.isAssistantAvailable(), true);
      expect(await api.getMyTickets(), isEmpty);
      expect(paths, ['/support/assistant/health', '/support/tickets']);
      api.close();
    },
  );
  test('logout during session loading prevents request', () async {
    final pending = Completer<StoredAuthSession?>();
    var calls = 0;
    final api = SupportApi(
      accessToken: 'synthetic',
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
      sessionStore: SyntheticSupportSession(pending.future),
    );
    final request = api.getMyTickets();
    await AuthSessionStore().clear();
    pending.complete(session);
    await expectLater(request, throwsA(isA<SupportApiException>()));
    expect(calls, 0);
    api.close();
  });
  test('late old-account ticket response is rejected', () async {
    final started = Completer<void>(), response = Completer<http.Response>();
    final api = SupportApi(
      accessToken: 'synthetic',
      client: MockClient((_) async {
        started.complete();
        return response.future;
      }),
      sessionStore: SyntheticSupportSession(Future.value(session)),
    );
    final request = api.getMyTickets();
    await started.future;
    await AuthSessionStore().clear();
    response.complete(
      http.Response('{"tickets":[{"subject":"private A"}]}', 200),
    );
    await expectLater(request, throwsA(isA<SupportApiException>()));
    api.close();
  });
  test('closed support client refuses further requests', () async {
    var calls = 0;
    final api = SupportApi(
      accessToken: 'synthetic',
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
      sessionStore: SyntheticSupportSession(Future.value(session)),
    );
    api.close();
    await expectLater(api.getMyTickets(), throwsA(isA<SupportApiException>()));
    expect(calls, 0);
  });
  test(
    'feedback preserves rating and category and uses authenticated token',
    () async {
      final api = FeedbackApi(
        sessionStore: SyntheticSupportSession(Future.value(session)),
        client: MockClient((request) async {
          expect(
            request.headers['Authorization'],
            'Bearer refreshed-synthetic',
          );
          expect(jsonDecode(request.body), {
            'category': 'GENERAL',
            'rating': 5,
            'message': 'Synthetic feedback',
          });
          return http.Response('{"success":true}', 201);
        }),
      );
      expect(
        (await api.submit(
          category: 'GENERAL',
          rating: 5,
          message: ' Synthetic feedback ',
        ))['success'],
        true,
      );
      api.close();
    },
  );
  test('feedback cannot dispatch after account switch', () async {
    var calls = 0;
    final api = FeedbackApi(
      sessionStore: SyntheticSupportSession(Future.value(session)),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await AuthSessionStore().clear();
    await expectLater(api.getMine(), throwsA(isA<FeedbackApiException>()));
    expect(calls, 0);
    api.close();
  });
  testWidgets('account boundary removes old rendered support content', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: SupportAccountBoundary(
          child: Scaffold(body: Text('private support A')),
        ),
      ),
    );
    expect(find.text('private support A'), findsOneWidget);
    await tester.runAsync(() => AuthSessionStore().clear());
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('private support A'), findsNothing);
    expect(
      find.text('Your account changed. Reopen Help & Support.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });
}
