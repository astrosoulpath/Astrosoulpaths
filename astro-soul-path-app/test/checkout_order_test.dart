import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/wallet/data/checkout_order.dart';

void main() {
  const valid = {'id': 'order_synthetic', 'amount': 350000, 'currency': 'INR'};
  test('server minor units and currency are preserved without conversion', () {
    final order = CheckoutOrder.fromServer(valid);
    expect(order.amount, 350000);
    expect(order.currency, 'INR');
  });
  test('integer string remains exact', () {
    expect(CheckoutOrder.fromServer({...valid, 'amount': '100'}).amount, 100);
  });
  for (final amount in [1.5, 1.0, '1.50', -1, 0, null, 9007199254740992]) {
    test('rejects invalid minor units $amount without rounding', () {
      expect(
        () => CheckoutOrder.fromServer({...valid, 'amount': amount}),
        throwsFormatException,
      );
    });
  }
  test('missing currency is rejected instead of silently assuming INR', () {
    expect(
      () => CheckoutOrder.fromServer({'id': 'order_synthetic', 'amount': 100}),
      throwsFormatException,
    );
  });
  test('malformed provider reference is rejected', () {
    expect(
      () => CheckoutOrder.fromServer({...valid, 'id': '../foreign'}),
      throwsFormatException,
    );
  });
}
