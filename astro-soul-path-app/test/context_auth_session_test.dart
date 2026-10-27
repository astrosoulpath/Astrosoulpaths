import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:astro_soul_path/features/auth/data/auth_api.dart';
import 'package:astro_soul_path/features/auth/data/auth_portal.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/customer_onboarding_flow.dart';

String source(String uid) =>
    'fixture.${base64Url.encode(utf8.encode(jsonEncode({'sub': uid}))).replaceAll('=', '')}.signature';
Map<String, dynamic> response({
  String id = 'canonical',
  String context = 'customer',
  String uid = 'fixture-owner',
}) => {
  'success': true,
  'portal': context,
  'role': context == 'customer' ? 'CUSTOMER' : 'ASTROLOGER',
  'nextStep': 'OPEN_HOME',
  'user': {
    'id': id,
    'accountRole': 'ADMIN',
    'authContext': context,
    'firebaseUid': uid,
  },
  'session': {
    'accessToken': 'aspctx.synthetic-renewed',
    'authProvider': 'asp-context',
    'authContext': context,
    'expiresIn': 900,
  },
};
VerifyOtpResult login() {
  final body = response();
  return VerifyOtpResult(
    message: 'synthetic',
    portal: 'customer',
    role: 'CUSTOMER',
    accessToken: 'aspctx.synthetic-initial',
    user: Map<String, dynamic>.from(body['user']),
    session: Map<String, dynamic>.from(body['session']),
    nextStep: 'OPEN_HOME',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'fresh Google context reaches completed onboarding via GET with no renewal POST',
    () async {
      final calls = <String>[], loads = <bool>[];
      final store = AuthSessionStore(
        firebaseTokenLoader: (force) async {
          loads.add(force);
          return source('fixture-owner');
        },
        refreshClient: MockClient((request) async {
          calls.add('${request.method} ${request.url.path}');
          expect(
            request.headers['Authorization'],
            'Bearer aspctx.synthetic-initial',
          );
          final body = response();
          body['user'] = <String, dynamic>{
            ...body['user'],
            'isProfileComplete': true,
          };
          return http.Response(jsonEncode(body), 200);
        }),
      );
      await store.save(login());
      expect(
        await completeCustomerOnboarding(
          sessions: store,
          loadProfiles: () async => throw StateError('Must skip profiles'),
          showForm: (_) async => throw StateError('Must skip form'),
        ),
        isTrue,
      );
      expect(calls, ['GET /user/session']);
      expect(loads, [false]);
    },
  );
  test('expired context renews once and then verifies restoration', () async {
    final calls = <String>[];
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => source('fixture-owner'),
      refreshClient: MockClient((r) async {
        calls.add('${r.method} ${r.url.path}');
        return http.Response(
          jsonEncode(response()),
          r.method == 'POST' ? 201 : 200,
        );
      }),
    );
    await store.save(login());
    final raw = jsonDecode(
      (await const FlutterSecureStorage().read(key: 'asp_user'))!,
    );
    raw['contextExpiresAt'] = 1;
    await const FlutterSecureStorage().write(
      key: 'asp_user',
      value: jsonEncode(raw),
    );
    expect(
      (await store.restore(portal: 'customer'))?.accessToken,
      'aspctx.synthetic-renewed',
    );
    expect(calls, ['POST /auth/context/refresh', 'GET /user/session']);
  });
  test(
    '201 successful renewal is compatible with existing Nest runtime',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => source('fixture-owner'),
        refreshClient: MockClient(
          (_) async => http.Response(jsonEncode(response()), 201),
        ),
      );
      await store.save(login());
      expect(
        (await store.forceRefresh())?.accessToken,
        'aspctx.synthetic-renewed',
      );
    },
  );
  test(
    'backend failure exposes only HTTP diagnostic category, not raw error',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => source('fixture-owner'),
        refreshClient: MockClient(
          (_) async => http.Response(
            '{"message":"private-token password postgresql://secret"}',
            503,
          ),
        ),
      );
      await store.save(login());
      await expectLater(
        store.forceRefresh(),
        throwsA(
          isA<AuthApiException>()
              .having((e) => e.code, 'code', 'CONTEXT_RENEWAL_HTTP_503')
              .having((e) => e.message, 'message', isNot(contains('secret'))),
        ),
      );
    },
  );
  test(
    'Google exchange retains backend Customer context rather than raw SDK token',
    () async {
      final api = AuthApi(
        client: MockClient((request) async {
          expect(request.url.path, '/auth/firebase/google');
          return http.Response(jsonEncode(response()), 200);
        }),
      );
      final result = await api.firebaseGoogleLogin(
        idToken: 'synthetic-source',
        portal: AuthPortal.customer,
      );
      expect(result.accessToken, 'aspctx.synthetic-renewed');
      expect(result.user['accountRole'], 'ADMIN');
      expect(result.session['authProvider'], 'asp-context');
    },
  );
  test(
    'password exchange forwards Astrologer portal and preserves its isolated context',
    () async {
      final api = AuthApi(
        client: MockClient((request) async {
          expect(jsonDecode(request.body)['portal'], 'joinAstrologer');
          return http.Response(
            jsonEncode(response(context: 'astrologer')),
            200,
          );
        }),
      );
      expect(
        (await api.firebaseEmailLogin(
          idToken: 'synthetic-source',
          portal: AuthPortal.joinAstrologer,
        )).session['authContext'],
        'astrologer',
      );
    },
  );
  test('legacy raw or mismatched context response fails closed', () async {
    for (final body in [
      <String, dynamic>{
        ...response(),
        'session': {'accessToken': 'raw-firebase', 'authProvider': 'firebase'},
      },
      response(context: 'admin'),
    ]) {
      final api = AuthApi(
        client: MockClient((_) async => http.Response(jsonEncode(body), 200)),
      );
      await expectLater(
        api.firebaseGoogleLogin(
          idToken: 'synthetic-source',
          portal: AuthPortal.customer,
        ),
        throwsA(isA<AuthApiException>()),
      );
    }
  });
  test(
    'Customer-scoped canonical Admin saves with no Supabase refresh token',
    () async {
      final store = AuthSessionStore();
      await store.save(login());
      final session = await store.read();
      expect(session?.authProvider, 'asp-context');
      expect(session?.user['accountRole'], 'ADMIN');
      expect(session?.portal, 'customer');
    },
  );
  test(
    'context refresh re-exchanges fresh same-UID Firebase proof without changing session revision',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => source('fixture-owner'),
        refreshClient: MockClient((request) async {
          expect(request.url.path, '/auth/context/refresh');
          expect(jsonDecode(request.body)['portal'], 'customer');
          return http.Response(jsonEncode(response()), 200);
        }),
      );
      await store.save(login());
      final revision = AuthSessionStore.sessionRevision;
      expect(
        (await store.forceRefresh())?.accessToken,
        'aspctx.synthetic-renewed',
      );
      expect(AuthSessionStore.sessionRevision, revision);
    },
  );
  test('different Firebase UID clears session before contacting API', () async {
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => source('other-owner'),
      refreshClient: MockClient(
        (_) async => throw StateError('Unexpected network'),
      ),
    );
    await store.save(login());
    expect(await store.forceRefresh(), isNull);
    expect(await store.read(), isNull);
  });
  test(
    'revoked SDK refresh clears scoped session without any API call',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async =>
            throw FirebaseAuthException(code: 'user-token-expired'),
        refreshClient: MockClient(
          (_) async => throw StateError('Unexpected network'),
        ),
      );
      await store.save(login());
      expect(await store.forceRefresh(), isNull);
      expect(await store.read(), isNull);
    },
  );
  test('renewal cannot transfer canonical account ownership', () async {
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => source('fixture-owner'),
      refreshClient: MockClient(
        (_) async =>
            http.Response(jsonEncode(response(id: 'other-account')), 200),
      ),
    );
    await store.save(login());
    await expectLater(store.forceRefresh(), throwsA(isA<AuthApiException>()));
    expect(await store.read(), isNull);
  });
  test('401/403 refresh clears scoped session', () async {
    for (final status in [401, 403]) {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => source('fixture-owner'),
        refreshClient: MockClient((_) async => http.Response('{}', status)),
      );
      await store.save(login());
      expect(await store.forceRefresh(), isNull);
      expect(await store.read(), isNull);
    }
  });
  test('logout fences a late scoped refresh response', () async {
    final release = Completer<void>(), started = Completer<void>();
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => source('fixture-owner'),
      refreshClient: MockClient((_) async {
        started.complete();
        await release.future;
        return http.Response(jsonEncode(response()), 200);
      }),
    );
    await store.save(login());
    final pending = store.forceRefresh();
    await started.future;
    await store.clear();
    release.complete();
    expect(await pending, isNull);
    expect(await store.read(), isNull);
  });
}
