import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/config/api_config.dart';

void main() {
  for (final value in [
    '',
    'http://api.astrosoulpath.com',
    'https://localhost',
    'https://127.0.0.1',
    'https://10.0.2.2:14101',
    'https://192.168.1.2',
    'https://172.16.0.1',
    'https://100.64.0.1',
    'https://[::1]',
    'https://[fc00::1]',
    'https://[fe80::1]',
    'https://backend.internal',
    'https://user:password@api.astrosoulpath.com',
    'https://api.astrosoulpath.com?token=private',
    'https://api.astrosoulpath.com#private',
  ]) {
    test(
      'release rejects absent, private or credential-bearing API $value',
      () {
        expect(() => ApiConfig.validateReleaseBaseUrl(value), throwsStateError);
      },
    );
  }
  test(
    'explicit public HTTPS release API preserves supported path and normalizes slash',
    () {
      expect(
        ApiConfig.validateReleaseBaseUrl(
          ' https://api.astrosoulpath.com/api/ ',
        ),
        'https://api.astrosoulpath.com/api',
      );
    },
  );
}
