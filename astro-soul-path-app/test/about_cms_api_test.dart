import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/app_config/data/app_config_api.dart';

void main() {
  test(
    'About reads dedicated public CMS without auth or shared config',
    () async {
      final client = MockClient((request) async {
        expect(request.url.path, '/app-config/about');
        expect(request.headers.containsKey('authorization'), false);
        return http.Response(
          jsonEncode({
            'success': true,
            'source': 'published',
            'data': {
              'revision': 2,
              'content': {
                'title': 'Published title',
                'introduction': 'Published introduction',
                'mission': 'Published mission',
                'vision': '',
              },
            },
          }),
          200,
        );
      });
      final result = await const AppConfigApi().getAboutConfig(client: client);
      expect(result.aboutTitle, 'Published title');
      expect(result.aboutSections?['mission'], 'Published mission');
      expect(result.aboutSource, 'published');
      client.close();
    },
  );
  for (final body in [
    null,
    {'success': false},
    {'success': true, 'data': {}},
    {
      'success': true,
      'data': {
        'content': {'title': '', 'introduction': ''},
      },
    },
  ]) {
    test('Rejects missing CMS content $body', () async {
      final client = MockClient(
        (_) async => http.Response(jsonEncode(body), 200),
      );
      await expectLater(
        const AppConfigApi().getAboutConfig(client: client),
        throwsA(isA<AppConfigApiException>()),
      );
      client.close();
    });
  }
  test(
    'HTTP failure remains failure rather than fabricated API success',
    () async {
      final client = MockClient((_) async => http.Response('{}', 503));
      await expectLater(
        const AppConfigApi().getAboutConfig(client: client),
        throwsA(isA<AppConfigApiException>()),
      );
      client.close();
    },
  );
}
