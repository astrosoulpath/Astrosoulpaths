import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/astrologer/data/earnings_currency.dart';

void main() {
  test('mixed currencies remain separate and retain zero', () {
    expect(
      earningsBuckets([
        {'currency': 'USD', 'amount': 0},
        {'currency': 'INR', 'amount': 70.125},
      ]),
      'USD 0.00 · INR 70.13',
    );
  });
  test('empty and missing totals are not invented INR zero', () {
    expect(earningsBuckets([]), 'No earnings');
    expect(earningsBuckets(null), 'Unavailable');
  });
  for (final value in [null, 'invalid', 'NaN', 'Infinity']) {
    test('invalid amount $value is unavailable', () {
      expect(earningsMoney(value, 'USD'), 'Unavailable');
    });
  }
  test('missing currency cannot be labelled INR', () {
    expect(earningsMoney(1, null), 'Unavailable');
  });
}
