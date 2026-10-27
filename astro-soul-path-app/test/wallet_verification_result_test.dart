import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_verification_result.dart';

void main() {
  test('only explicit backend success can show wallet success', () {
    expect(
      walletVerificationStatus({'success': true, 'status': 'SUCCESS'}),
      'success',
    );
  });
  test('pending stays pending and must retain recovery', () {
    expect(
      walletVerificationStatus({'success': true, 'status': 'PENDING'}),
      'pending',
    );
  });
  test('success-shaped rejected payload is not payment proof', () {
    expect(
      () => walletVerificationStatus({'success': false, 'status': 'SUCCESS'}),
      throwsFormatException,
    );
  });
  test('unknown or incomplete statuses never clear a pending payment', () {
    for (final value in [null, 'paid', 'success', 'REFUNDED', 1]) {
      expect(
        () => walletVerificationStatus({'success': true, 'status': value}),
        throwsFormatException,
      );
    }
  });
}
