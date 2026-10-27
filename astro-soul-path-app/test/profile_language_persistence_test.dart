import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/core/localization/app_locale_controller.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/profile/data/profile_api.dart';

class Sessions extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic-context',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: 'OPEN_HOME',
    user: {'id': 'canonical'},
    expiresIn: 3600,
    authProvider: 'asp-context',
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  tearDown(() => AppLocaleController.locale.value = const Locale('en'));

  test('saved locale is restored after notifier reconstruction', () async {
    await AppLocaleController.setLanguage('hi');
    AppLocaleController.locale.value = const Locale('en');
    await AppLocaleController.loadCached();
    expect(AppLocaleController.languageCode, 'hi');
  });

  test(
    'authenticated profile language is sent and read back, without personal fields',
    () async {
      final api = ProfileApi(
        sessionStore: Sessions(),
        client: MockClient((request) async {
          expect(request.method, 'PATCH');
          expect(request.url.path, '/user/profile');
          expect(request.headers['Authorization'], 'Bearer synthetic-context');
          expect(jsonDecode(request.body), {'lang': 'hi'});
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'id': 'profile', 'userId': 'canonical', 'lang': 'hi'},
            }),
            200,
          );
        }),
      );
      addTearDown(api.close);
      final saved = await api.updateProfile(
        profileId: 'profile',
        language: 'hi',
      );
      expect(saved.language, 'hi');
    },
  );
}
