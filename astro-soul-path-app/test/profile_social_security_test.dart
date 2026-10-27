import 'dart:async';
import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/follow/data/follow_api.dart';
import 'package:astro_soul_path/features/app_config/data/official_app_links.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/feedback/data/feedback_api.dart';
import 'package:astro_soul_path/features/app_config/data/app_config_api.dart';
import 'package:astro_soul_path/features/app_config/data/app_config_model.dart';
import 'package:astro_soul_path/features/rate_app/services/rate_app_service.dart';

class _MissingConfig extends AppConfigApi {
  @override
  Future<AppConfigModel> getPublicConfig() async =>
      throw const AppConfigApiException(
        'Missing config',
        configurationMissing: true,
      );
}

class _Session extends AuthSessionStore {
  _Session(this.value);
  final Future<StoredAuthSession?> value;
  @override
  Future<StoredAuthSession?> read() => value;
}

const _customer = StoredAuthSession(
  accessToken: 'synthetic-context',
  refreshToken: '',
  role: 'CUSTOMER',
  portal: 'customer',
  nextStep: '',
  user: {'id': 'synthetic'},
  expiresIn: 900,
);
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'Rate App reports missing official configuration instead of a fake launch failure',
    () async {
      expect(
        await RateAppService(appConfigApi: _MissingConfig()).openStoreListing(),
        RateAppResult.storeNotConfigured,
      );
    },
  );
  test(
    'feedback omits unselected rating and requires server confirmation',
    () async {
      var confirmed = false;
      final api = FeedbackApi(
        sessionStore: _Session(Future.value(_customer)),
        client: MockClient((r) async {
          expect(jsonDecode(r.body).containsKey('rating'), false);
          return http.Response(confirmed ? '{"success":true}' : '{}', 201);
        }),
      );
      await expectLater(
        api.submit(category: 'GENERAL', message: 'Synthetic optional rating'),
        throwsA(isA<FeedbackApiException>()),
      );
      confirmed = true;
      expect(
        (await api.submit(
          category: 'GENERAL',
          message: 'Synthetic optional rating',
        ))['success'],
        true,
      );
      api.close();
    },
  );
  test(
    'Google/context follow uses current session, encoded target and authoritative server count',
    () async {
      final api = FollowApi(
        sessionStore: _Session(Future.value(_customer)),
        client: MockClient((r) async {
          expect(r.headers['Authorization'], 'Bearer synthetic-context');
          expect(r.method, 'POST');
          expect(r.url.pathSegments.last, 'real target');
          return http.Response(
            jsonEncode({'followerCount': 42, 'isFollowing': true}),
            200,
          );
        }),
      );
      final status = await api.followReal('real target');
      expect(status.followerCount, 42);
      expect(status.isFollowing, true);
      api.close();
    },
  );
  test('unauthenticated follow never reaches transport', () async {
    var calls = 0;
    final api = FollowApi(
      sessionStore: _Session(Future.value(null)),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(api.followReal('a'), throwsA(isA<FollowApiException>()));
    expect(calls, 0);
    api.close();
  });
  test('Admin portal credentials cannot be used as Customer follows', () async {
    const admin = StoredAuthSession(
      accessToken: 'synthetic-admin',
      refreshToken: '',
      role: 'ADMIN',
      portal: 'admin',
      nextStep: '',
      user: {},
      expiresIn: 900,
    );
    var calls = 0;
    final api = FollowApi(
      sessionStore: _Session(Future.value(admin)),
      client: MockClient((_) async {
        calls++;
        return http.Response('{}', 200);
      }),
    );
    await expectLater(api.followReal('a'), throwsA(isA<FollowApiException>()));
    expect(calls, 0);
    api.close();
  });
  test(
    'logout during token acquisition prevents an old-account write',
    () async {
      final pending = Completer<StoredAuthSession?>();
      var calls = 0;
      final api = FollowApi(
        sessionStore: _Session(pending.future),
        client: MockClient((_) async {
          calls++;
          return http.Response('{}', 200);
        }),
      );
      final result = api.followReal('a');
      await AuthSessionStore().clear();
      pending.complete(_customer);
      await expectLater(result, throwsA(isA<FollowApiException>()));
      expect(calls, 0);
      api.close();
    },
  );
  test('late response cannot overwrite the next account state', () async {
    final started = Completer<void>(), response = Completer<http.Response>();
    final api = FollowApi(
      sessionStore: _Session(Future.value(_customer)),
      client: MockClient((_) async {
        started.complete();
        return response.future;
      }),
    );
    final result = api.getRealStatus('a');
    await started.future;
    await AuthSessionStore().clear();
    response.complete(
      http.Response('{"isFollowing":true,"followerCount":9}', 200),
    );
    await expectLater(result, throwsA(isA<FollowApiException>()));
    api.close();
  });
  for (final body in [
    '{}',
    'not json',
    '{"isFollowing":true}',
    '{"isFollowing":true,"followerCount":-1}',
  ]) {
    test('malformed follow response never becomes fake zero: $body', () async {
      final api = FollowApi(
        sessionStore: _Session(Future.value(_customer)),
        client: MockClient((_) async => http.Response(body, 200)),
      );
      await expectLater(
        api.getRealStatus('a'),
        throwsA(isA<FollowApiException>()),
      );
      api.close();
    });
  }
  test('closed client cannot submit', () async {
    final api = FollowApi(sessionStore: _Session(Future.value(_customer)));
    api.close();
    await expectLater(api.followReal('a'), throwsA(isA<FollowApiException>()));
  });
  test('approval is not a verified badge', () {
    expect(
      PublicAstrologer.fromJson({'id': 'a', 'isApproved': true}).isVerified,
      false,
    );
    expect(
      PublicAstrologer.fromJson({'id': 'a', 'isVerified': true}).isVerified,
      true,
    );
  });
  test(
    'missing price/availability never become a fabricated free rate or offline claim',
    () {
      final missing = PublicAstrologerProfile.fromJson({'id': 'synthetic'});
      expect(missing.astrologer.priceLabel, 'Price not available');
      expect(missing.astrologer.primaryExpertise, 'Expertise not specified');
      expect(missing.availability, 'Availability not provided');
      expect(
        PublicAstrologer.fromJson({
          'id': 'synthetic',
          'pricePerMin': 0,
        }).priceLabel,
        '₹0/min',
      );
    },
  );
  test(
    'official store URLs require correct host/package and real configured ID',
    () {
      expect(OfficialAppLinks.store('', ios: false), isNull);
      expect(
        OfficialAppLinks.store(
          'https://play.google.com/store/apps/details?id=other',
          ios: false,
        ),
        isNull,
      );
      expect(
        OfficialAppLinks.store(
          'https://play.google.com.evil.test/store/apps/details?id=${OfficialAppLinks.androidPackage}',
          ios: false,
        ),
        isNull,
      );
      expect(
        OfficialAppLinks.store(
          'https://play.google.com/store/apps/details?id=${OfficialAppLinks.androidPackage}',
          ios: false,
        ),
        isNotNull,
      );
      expect(
        OfficialAppLinks.store(
          'https://apps.apple.com/app/example/id123456',
          ios: true,
        ),
        isNotNull,
      );
      expect(
        OfficialAppLinks.store('https://apps.apple.com/app/example', ios: true),
        isNull,
      );
      expect(OfficialAppLinks.website('javascript:alert(1)'), isNull);
      expect(
        OfficialAppLinks.website('https://user:pass@example.test'),
        isNull,
      );
    },
  );
}
