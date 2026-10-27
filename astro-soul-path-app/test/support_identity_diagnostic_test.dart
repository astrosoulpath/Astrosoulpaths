import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/support_identity_diagnostic.dart';

void main() {
  test('identity diagnostics retain only allowlisted roles and booleans', () {
    expect(
      sanitizeIdentityResult({
        'storedRole': 'ADMIN',
        'sameIdentity': true,
        'supportStatus': 403,
        'failurePoint': 'ADMIN_IDENTITY_NOT_ALLOWED',
        'uid': 'private',
        'token': 'private',
        'email': 'private',
      }),
      {
        'storedRole': 'ADMIN',
        'sameIdentity': true,
        'supportStatus': 403,
        'failurePoint': 'ADMIN_IDENTITY_NOT_ALLOWED',
      },
    );
  });
  test('private values cannot enter even allowlisted output fields', () {
    final safe = sanitizeIdentityResult({
      'storedRole': 'private-token',
      'sdkRole': {'uid': 'private'},
      'stage': 'private-email',
      'failurePoint': 'postgresql://private',
      'sameIdentity': 'private',
      'supportStatus': 'private',
    });
    expect(safe, isEmpty);
    expect(sanitizeIdentityResult(null), {
      'failurePoint': 'DIAGNOSTIC_UNAVAILABLE',
    });
  });
}
