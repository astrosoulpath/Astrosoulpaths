import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/consultations/data/birth_sharing_api.dart';
import 'package:astro_soul_path/features/consultations/presentation/widgets/birth_sharing_panel.dart';

class _Session extends AuthSessionStore {
  String owner = 'synthetic-owner';
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': owner},
    expiresIn: 3600,
  );
}

class _Api extends BirthSharingApi {
  bool sameOwner = true;
  @override
  Future<bool> hasSameOwner() async => sameOwner;
  String state = 'NOT_SHARED';
  bool customer = true;
  bool fail = false;
  final actions = <String>[];
  @override
  Future<Map<String, dynamic>> request(
    String id, {
    String action = '',
    Map<String, dynamic>? body,
  }) async {
    actions.add(action);
    if (fail) throw StateError('synthetic');
    if (action == 'grant') {
      expect(body?['birthVersion'], 'synthetic-version');
      expect(body?['profileRef'], 'user:synthetic');
      expect(body?['revision'], 0);
      state = 'SHARED';
    }
    if (action == 'revoke') state = 'REVOKED';
    return {
      'isCustomer': customer,
      'state': state,
      'birthVersion': 'synthetic-version',
      'policyVersion': 'consultation-birth-sharing-v2',
      'profileRef': 'user:synthetic',
      'revision': 0,
      'profiles': [
        {'profileRef': 'user:synthetic', 'label': 'Synthetic profile'},
      ],
      'astrologerName': 'Synthetic assigned astrologer',
      'expiresAt': DateTime.now()
          .add(const Duration(minutes: 1))
          .toIso8601String(),
      'details': state == 'REVOKED' || !customer && state != 'SHARED'
          ? null
          : {
              'fullName': 'Synthetic name',
              'dateOfBirth': '2000-01-01',
              'timeOfBirth': '10:30',
              'birthPlace': 'Synthetic place',
            },
    };
  }
}

class _SelectingApi extends _Api {
  @override
  Future<Map<String, dynamic>> request(
    String id, {
    String action = '',
    Map<String, dynamic>? body,
  }) async {
    final result = await super.request(id, action: action, body: body);
    if (action.isEmpty && body?['profileRef'] == null) {
      result['state'] = 'PROFILE_SELECTION_REQUIRED';
      result['details'] = null;
    }
    return result;
  }
}

class _LateLogoutSession extends _Session {
  int reads = 0;
  @override
  Future<StoredAuthSession?> read() async {
    if (++reads == 2) await AuthSessionStore().clear();
    return super.read();
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
    'logout during postflight read fences an identical owner response',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final api = BirthSharingApi(
        sessions: _LateLogoutSession(),
        client: MockClient(
          (_) async => http.Response('{"state":"SHARED","details":null}', 200),
        ),
      );
      await expectLater(api.request('synthetic'), throwsStateError);
      api.close();
    },
  );
  testWidgets('explicit profile selection reveals preview on narrow screens', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = _SelectingApi();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: BirthSharingPanel(consultationId: 'synthetic', api: api),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Synthetic name'), findsNothing);
    await tester.tap(find.byType(DropdownButtonFormField<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Synthetic profile').last);
    await tester.pumpAndSettle();
    expect(find.text('Synthetic name'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  test('selected profile is sent as a query, never as a GET body', () async {
    final api = BirthSharingApi(
      sessions: _Session(),
      client: MockClient((request) async {
        expect(request.url.queryParameters['profileRef'], 'saved:synthetic');
        expect(request.body, isEmpty);
        return http.Response('{"state":"NOT_SHARED","details":null}', 200);
      }),
    );
    await api.request('consultation', body: {'profileRef': 'saved:synthetic'});
    api.close();
  });
  testWidgets(
    'account change clears cached details within the local ownership bound',
    (tester) async {
      final api = _Api()
        ..state = 'SHARED'
        ..customer = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: BirthSharingPanel(consultationId: 'synthetic', api: api),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Synthetic name'), findsOneWidget);
      api.sameOwner = false;
      await tester.pump(const Duration(seconds: 5));
      await tester.pump();
      expect(find.text('Synthetic name'), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );
  test(
    'new sharing UI is disabled by default',
    () => expect(birthSharingEnabled, false),
  );
  test('in-flight account switch rejects sensitive response', () async {
    final session = _Session();
    final response = Completer<http.Response>();
    final api = BirthSharingApi(
      sessions: session,
      client: MockClient((_) => response.future),
    );
    final pending = api.request('consultation');
    await Future<void>.delayed(Duration.zero);
    session.owner = 'different-owner';
    response.complete(
      http.Response('{"details":{"fullName":"Synthetic"}}', 200),
    );
    await expectLater(pending, throwsStateError);
    api.close();
  });
  test('authorization failure is not retried or exposed', () async {
    var calls = 0;
    final api = BirthSharingApi(
      sessions: _Session(),
      client: MockClient((_) async {
        calls++;
        return http.Response('private raw response', 403);
      }),
    );
    await expectLater(api.request('consultation'), throwsStateError);
    expect(calls, 1);
    api.close();
  });
  testWidgets(
    'customer reviews, explicitly grants and revokes without a chat message',
    (tester) async {
      final api = _Api();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: BirthSharingPanel(consultationId: 'synthetic', api: api),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Synthetic name'), findsOneWidget);
      expect(api.actions, ['']);
      await tester.ensureVisible(find.text('I agree — share these details'));
      await tester.tap(find.text('I agree — share these details'));
      await tester.pumpAndSettle();
      expect(api.actions, ['', 'grant']);
      await tester.ensureVisible(find.text('Revoke sharing'));
      await tester.tap(find.text('Revoke sharing'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic name'), findsNothing);
      expect(find.text('Permission revoked.'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('astrologer receives no details without consent', (tester) async {
    final api = _Api()..customer = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: BirthSharingPanel(consultationId: 'synthetic', api: api),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Synthetic name'), findsNothing);
    expect(find.text('I agree — share these details'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('failed refresh removes previously displayed data', (
    tester,
  ) async {
    final api = _Api()
      ..state = 'SHARED'
      ..customer = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: BirthSharingPanel(consultationId: 'synthetic', api: api),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Synthetic name'), findsOneWidget);
    api.fail = true;
    await tester.ensureVisible(find.text('Refresh permission'));
    await tester.tap(find.text('Refresh permission'));
    await tester.pumpAndSettle();
    expect(find.text('Synthetic name'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
