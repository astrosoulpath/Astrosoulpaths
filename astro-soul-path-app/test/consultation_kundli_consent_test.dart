import 'dart:convert';
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/kundli/data/consultation_kundli_api.dart';
import 'package:astro_soul_path/features/kundli/presentation/screens/consultation_kundli_consent_screen.dart';

class _Sessions extends AuthSessionStore {
  String? id = 'synthetic-user';
  @override
  Future<StoredAuthSession?> read() async => id == null
      ? null
      : StoredAuthSession(
          accessToken: 'synthetic-token',
          refreshToken: '',
          role: 'CUSTOMER',
          portal: 'customer',
          nextStep: '',
          user: {'id': id},
          expiresIn: 3600,
        );
}

class _Api extends ConsultationKundliApi {
  _Api() : super(enabled: true);
  int reads = 0, grants = 0, revokes = 0;
  bool deny = false;
  Map<String, dynamic> state = {
    'astrologerName': 'Synthetic Astrologer',
    'state': 'REQUIRED',
    'canGrant': true,
    'canRevoke': false,
    'canGenerate': false,
  };
  @override
  Future<Map<String, dynamic>> status(String id) async {
    reads++;
    if (deny) throw const ConsultationKundliException('Access denied');
    return state;
  }

  @override
  Future<Map<String, dynamic>> grant(String id) async {
    grants++;
    return state = {
      'state': 'GRANTED',
      'consentId': 'synthetic-grant',
      'canGrant': true,
      'canRevoke': true,
      'canGenerate': false,
    };
  }

  @override
  Future<Map<String, dynamic>> revoke(String id) async {
    revokes++;
    return state = {
      'state': 'REVOKED',
      'canRevoke': false,
      'canGenerate': false,
    };
  }
}

class _DeferredSessions extends AuthSessionStore {
  final result = Completer<StoredAuthSession?>();
  @override
  Future<StoredAuthSession?> read() => result.future;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'logout and same-account login cannot revive an existing consent client',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      var calls = 0;
      final api = ConsultationKundliApi(
        enabled: true,
        sessions: _Sessions(),
        client: MockClient((_) async {
          calls++;
          return http.Response('{"success":true,"data":{}}', 200);
        }),
      );
      await api.status('synthetic');
      await AuthSessionStore().clear();
      await expectLater(
        api.grant('synthetic'),
        throwsA(isA<ConsultationKundliException>()),
      );
      expect(calls, 1);
      api.close();
    },
  );
  test(
    'logout during response rejects even if a session reader still returns the same ID',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = ConsultationKundliApi(
        enabled: true,
        sessions: _Sessions(),
        client: MockClient((_) async {
          await AuthSessionStore().clear();
          return http.Response(
            '{"success":true,"data":{"canGenerate":true}}',
            200,
          );
        }),
      );
      await expectLater(
        api.status('synthetic'),
        throwsA(isA<ConsultationKundliException>()),
      );
      api.close();
    },
  );
  test(
    'disposal during session refresh prevents request transmission',
    () async {
      final sessions = _DeferredSessions();
      var calls = 0;
      final api = ConsultationKundliApi(
        enabled: true,
        sessions: sessions,
        client: MockClient((_) async {
          calls++;
          return http.Response('{"success":true,"data":{}}', 200);
        }),
      );
      final pending = api.grant('synthetic');
      final rejected = expectLater(
        pending,
        throwsA(isA<ConsultationKundliException>()),
      );
      api.close();
      sessions.result.complete(await _Sessions().read());
      await rejected;
      expect(calls, 0);
    },
  );
  test('delayed grant cannot use another account token after status', () async {
    final sessions = _Sessions();
    var calls = 0;
    final api = ConsultationKundliApi(
      enabled: true,
      sessions: sessions,
      client: MockClient((_) async {
        calls++;
        return http.Response('{"success":true,"data":{}}', 200);
      }),
    );
    await api.status('synthetic');
    sessions.id = 'other';
    await expectLater(
      api.grant('synthetic'),
      throwsA(isA<ConsultationKundliException>()),
    );
    expect(calls, 1);
    api.close();
  });
  test('disposed API never sends a new consent request', () async {
    var calls = 0;
    final api = ConsultationKundliApi(
      enabled: true,
      sessions: _Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{"success":true,"data":{}}', 200);
      }),
    );
    api.close();
    await expectLater(
      api.grant('synthetic'),
      throwsA(isA<ConsultationKundliException>()),
    );
    expect(calls, 0);
  });
  testWidgets(
    'foreground recovery refreshes revoked permission and removes generation',
    (tester) async {
      final api = _Api()..state = {'state': 'GRANTED', 'canGenerate': true};
      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationKundliConsentScreen(
            consultationId: 'synthetic',
            api: api,
            enabled: true,
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Generate local Kundli'), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      api.state = {'state': 'REVOKED', 'canGenerate': false};
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpAndSettle();
      expect(find.text('Generate local Kundli'), findsNothing);
      expect(find.text('Permission: REVOKED'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('named consent dialog decline never grants permission', (
    tester,
  ) async {
    final api = _Api();
    await tester.pumpWidget(
      MaterialApp(
        home: ConsultationKundliConsentScreen(
          consultationId: 'synthetic',
          api: api,
          enabled: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Astrologer: Synthetic Astrologer'), findsOneWidget);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester.tap(find.text('Grant permission'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Decline'));
    await tester.pumpAndSettle();
    expect(api.grants, 0);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('missing verified astrologer name prevents consent grant', (
    tester,
  ) async {
    final api = _Api()..state.remove('astrologerName');
    await tester.pumpWidget(
      MaterialApp(
        home: ConsultationKundliConsentScreen(
          consultationId: 'synthetic',
          api: api,
          enabled: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Grant permission'),
          )
          .onPressed,
      isNull,
    );
    expect(api.grants, 0);
    await tester.pumpWidget(const SizedBox());
  });
  test('disabled API makes no authenticated request', () async {
    var calls = 0;
    final api = ConsultationKundliApi(
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(
      api.status('synthetic'),
      throwsA(isA<ConsultationKundliException>()),
    );
    expect(calls, 0);
    api.close();
  });
  test(
    'grant sends explicit notice acceptance only, not private birth data',
    () async {
      final api = ConsultationKundliApi(
        enabled: true,
        sessions: _Sessions(),
        client: MockClient((request) async {
          expect(request.method, 'POST');
          expect(jsonDecode(request.body), {
            'accepted': true,
            'policyVersion': 'kundli-local-v1',
          });
          return http.Response(
            '{"success":true,"data":{"state":"GRANTED"}}',
            200,
          );
        }),
      );
      expect((await api.grant('synthetic'))['state'], 'GRANTED');
      api.close();
    },
  );
  test('account switch discards an old-account response', () async {
    final sessions = _Sessions();
    final api = ConsultationKundliApi(
      enabled: true,
      sessions: sessions,
      client: MockClient((_) async {
        sessions.id = 'other';
        return http.Response('{"success":true,"data":{}}', 200);
      }),
    );
    await expectLater(
      api.status('synthetic'),
      throwsA(
        isA<ConsultationKundliException>().having(
          (e) => e.message,
          'message',
          contains('Account changed'),
        ),
      ),
    );
    api.close();
  });
  test('failed success envelope is rejected without automatic retry', () async {
    var calls = 0;
    final api = ConsultationKundliApi(
      enabled: true,
      sessions: _Sessions(),
      client: MockClient((_) async {
        calls++;
        return http.Response('{"success":false,"data":{}}', 200);
      }),
    );
    await expectLater(
      api.generate('synthetic', ConsultationKundliApi.newRequestKey()),
      throwsA(isA<ConsultationKundliException>()),
    );
    expect(calls, 1);
    api.close();
  });
  test('request keys are valid independent UUIDs', () {
    final a = ConsultationKundliApi.newRequestKey(),
        b = ConsultationKundliApi.newRequestKey();
    expect(a, isNot(b));
    expect(
      a,
      matches(
        RegExp(
          r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
        ),
      ),
    );
  });
  testWidgets('default-off screen does not read or grant consent', (
    tester,
  ) async {
    final api = _Api();
    await tester.pumpWidget(
      MaterialApp(
        home: ConsultationKundliConsentScreen(
          consultationId: 'synthetic',
          api: api,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(api.reads, 0);
    expect(find.text('Grant permission'), findsNothing);
  });
  testWidgets('grant requires explicit checkbox and supports revoke', (
    tester,
  ) async {
    final api = _Api();
    await tester.pumpWidget(
      MaterialApp(
        home: ConsultationKundliConsentScreen(
          consultationId: 'synthetic',
          api: api,
          enabled: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<FilledButton>(
            find.widgetWithText(FilledButton, 'Grant permission'),
          )
          .onPressed,
      isNull,
    );
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pump();
    await tester.tap(find.text('Grant permission'));
    await tester.pumpAndSettle();
    expect(
      find.text('Allow Synthetic Astrologer to generate your Kundli?'),
      findsOneWidget,
    );
    await tester.tap(find.text('Allow'));
    await tester.pumpAndSettle();
    expect(api.grants, 1);
    expect(find.text('Permission: GRANTED'), findsOneWidget);
    await tester.tap(find.text('Revoke permission'));
    await tester.pumpAndSettle();
    expect(api.revokes, 1);
    expect(find.text('Permission: REVOKED'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('denied refresh removes previously enabled generation action', (
    tester,
  ) async {
    final api = _Api()..state = {'state': 'GRANTED', 'canGenerate': true};
    await tester.pumpWidget(
      MaterialApp(
        home: ConsultationKundliConsentScreen(
          consultationId: 'synthetic',
          api: api,
          enabled: true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Generate local Kundli'), findsOneWidget);
    api.deny = true;
    await tester.tap(find.text('Refresh permission'));
    await tester.pumpAndSettle();
    expect(find.text('Generate local Kundli'), findsNothing);
    expect(find.text('Access denied'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
