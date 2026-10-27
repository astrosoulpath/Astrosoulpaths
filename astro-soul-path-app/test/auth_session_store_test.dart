import 'dart:async';
import 'dart:convert';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/secure_logout.dart';
import 'package:astro_soul_path/features/auth/data/auth_api.dart';

String jwt(String uid, int exp) {
  final payload = base64Url
      .encode(utf8.encode(jsonEncode({'sub': uid, 'exp': exp})))
      .replaceAll('=', '');
  return 'header.$payload.signature';
}

void seed({String portal = 'astrologer', String role = 'ASTROLOGER'}) {
  FlutterSecureStorage.setMockInitialValues({
    'asp_access_token': jwt('firebase-owner', 1),
    'asp_refresh_token': '',
    'asp_role': role,
    'asp_portal': portal,
    'asp_next_step': 'OPEN_ASTROLOGER_DASHBOARD',
    'asp_user': jsonEncode({'id': 'original'}),
    'asp_expires_in': '3600',
    'asp_auth_provider': 'firebase',
  });
}

String freshJwt() =>
    jwt('firebase-owner', DateTime.now().millisecondsSinceEpoch ~/ 1000 + 3600);
Map<String, dynamic> state({
  String portal = 'astrologer',
  String role = 'ASTROLOGER_APPLICANT',
  String id = 'original',
  String step = 'WAIT_FOR_ADMIN_APPROVAL',
}) => {
  'success': true,
  'portal': portal,
  'role': role,
  'nextStep': step,
  'user': {'id': id, 'isPhoneVerified': true},
};
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(seed);
  test(
    'canonical Admin cannot be saved as a Customer presentation session',
    () async {
      final store = AuthSessionStore();
      await expectLater(
        store.save(
          VerifyOtpResult(
            message: 'synthetic',
            portal: 'customer',
            role: 'CUSTOMER',
            accessToken: freshJwt(),
            user: {'id': 'original', 'accountRole': 'ADMIN'},
            session: {'authProvider': 'firebase'},
            nextStep: 'OPEN_HOME',
          ),
        ),
        throwsA(isA<AuthApiException>()),
      );
      expect(await store.read(), isNull);
    },
  );
  test(
    'previously masked Admin cache is not restored into Customer Home',
    () async {
      seed(portal: 'customer', role: 'CUSTOMER');
      await const FlutterSecureStorage().write(
        key: 'asp_user',
        value: jsonEncode({'id': 'original', 'accountRole': 'ADMIN'}),
      );
      var tokenCalls = 0;
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async {
          tokenCalls++;
          return freshJwt();
        },
      );
      expect(await store.read(), isNull);
      expect(tokenCalls, 0);
    },
  );
  test(
    'server restoration cannot disguise canonical Admin as Customer',
    () async {
      seed(portal: 'customer', role: 'CUSTOMER');
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => freshJwt(),
        refreshClient: MockClient(
          (_) async => http.Response(
            jsonEncode({
              ...state(portal: 'customer', role: 'CUSTOMER', step: 'OPEN_HOME'),
              'user': {'id': 'original', 'accountRole': 'ADMIN'},
            }),
            200,
          ),
        ),
      );
      expect(await store.restore(), isNull);
      expect(await store.read(), isNull);
    },
  );
  test('Firebase token refreshes despite empty refresh token', () async {
    var calls = 0;
    final store = AuthSessionStore(
      firebaseTokenLoader: (force) async {
        expect(force, true);
        calls++;
        return freshJwt();
      },
    );
    final session = await store.read();
    expect(calls, 1);
    expect(session?.accessToken, freshJwt());
  });
  test('concurrent Firebase refresh shares one operation', () async {
    final token = Completer<String?>();
    var calls = 0;
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) {
        calls++;
        return token.future;
      },
    );
    final first = store.forceRefresh();
    final second = store.forceRefresh();
    await Future<void>.delayed(const Duration(milliseconds: 20));
    token.complete(freshJwt());
    await Future.wait([first, second]);
    expect(calls, 1);
  });
  test(
    'Firebase token from another UID clears session instead of switching account',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => jwt('foreign-uid', 9999999999),
      );
      expect(await store.forceRefresh(), isNull);
      expect(await store.read(), isNull);
    },
  );
  test('revoked native Firebase session is cleared', () async {
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async =>
          throw FirebaseAuthException(code: 'user-token-expired'),
    );
    expect(await store.forceRefresh(), isNull);
    expect(await store.read(), isNull);
  });
  test(
    'restoration replaces cached dashboard approval with server pending state',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => freshJwt(),
        refreshClient: MockClient((request) async {
          expect(request.url.path, '/user/session');
          expect(request.url.queryParameters['portal'], 'astrologer');
          return http.Response(jsonEncode(state()), 200);
        }),
      );
      final restored = await store.restore();
      expect(restored?.role, 'ASTROLOGER_APPLICANT');
      expect(restored?.nextStep, 'WAIT_FOR_ADMIN_APPROVAL');
      expect((await store.read())?.nextStep, 'WAIT_FOR_ADMIN_APPROVAL');
    },
  );
  test('application inspection preserves customer portal in storage', () async {
    seed(portal: 'customer', role: 'CUSTOMER');
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => freshJwt(),
      refreshClient: MockClient((request) async {
        expect(request.url.queryParameters['portal'], 'joinAstrologer');
        return http.Response(jsonEncode(state(portal: 'joinAstrologer')), 200);
      }),
    );
    expect(
      (await store.restore(portal: 'joinAstrologer', persist: false))?.portal,
      'joinAstrologer',
    );
    expect((await store.read())?.portal, 'customer');
  });
  test(
    'canonical ID mismatch refuses restoration and clears storage',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => freshJwt(),
        refreshClient: MockClient(
          (_) async => http.Response(jsonEncode(state(id: 'foreign')), 200),
        ),
      );
      await expectLater(store.restore(), throwsStateError);
      expect(await store.read(), isNull);
    },
  );
  test('server rejection clears cached role and session', () async {
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => freshJwt(),
      refreshClient: MockClient((_) async => http.Response('{}', 401)),
    );
    expect(await store.restore(), isNull);
    expect(await store.read(), isNull);
  });
  test(
    'transient server error does not authorize cached dashboard or destroy session',
    () async {
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) async => freshJwt(),
        refreshClient: MockClient((_) async => http.Response('{}', 503)),
      );
      await expectLater(store.restore(), throwsStateError);
      expect(await store.read(), isNotNull);
    },
  );
  test(
    'logout signs out providers and late refresh cannot restore account',
    () async {
      final pending = Completer<String?>();
      final store = AuthSessionStore(
        firebaseTokenLoader: (_) => pending.future,
      );
      final refresh = store.forceRefresh();
      await Future<void>.delayed(const Duration(milliseconds: 20));
      final calls = <String>[];
      await secureLogout(
        store,
        signOutFirebase: () async {
          calls.add('firebase');
        },
        signOutGoogle: () async {
          calls.add('google');
        },
        signOutLegacy: () async {},
      );
      pending.complete(freshJwt());
      expect(await refresh, isNull);
      expect(await store.read(), isNull);
      expect(calls, ['firebase', 'google']);
    },
  );
  test('late backend session restoration cannot resurrect logout', () async {
    final pending = Completer<http.Response>();
    final started = Completer<void>();
    final store = AuthSessionStore(
      firebaseTokenLoader: (_) async => freshJwt(),
      refreshClient: MockClient((_) {
        started.complete();
        return pending.future;
      }),
    );
    final restore = store.restore();
    await started.future;
    await store.clear();
    pending.complete(http.Response(jsonEncode(state()), 200));
    expect(await restore, isNull);
    expect(await store.read(), isNull);
  });
  test(
    'native logout failure is reported while application session stays cleared',
    () async {
      final store = AuthSessionStore();
      var googleCalled = false;
      await expectLater(
        secureLogout(
          store,
          signOutFirebase: () async => throw StateError('native'),
          signOutGoogle: () async {
            googleCalled = true;
          },
          signOutLegacy: () async {},
        ),
        throwsStateError,
      );
      expect(googleCalled, true);
      expect(await store.read(), isNull);
    },
  );
  test(
    'storage failure still attempts every native provider and reports failure',
    () async {
      final store = FailingClearStore();
      final calls = <String>[];
      await expectLater(
        secureLogout(
          store,
          signOutFirebase: () async {
            calls.add('firebase');
          },
          signOutGoogle: () async {
            calls.add('google');
          },
          signOutLegacy: () async {
            calls.add('legacy');
          },
        ),
        throwsStateError,
      );
      expect(calls, ['firebase', 'google', 'legacy']);
      expect(store.clears, 2);
    },
  );
}

class FailingClearStore extends AuthSessionStore {
  int clears = 0;
  @override
  Future<void> clear() async {
    clears++;
    throw StateError('storage unavailable');
  }
}
