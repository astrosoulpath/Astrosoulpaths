import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/marketplace/presentation/marketplace_address_picker.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_payment_state.dart';

void main() {
  test('callback or status alone cannot confirm payment', () {
    expect(
      marketplacePaymentState({'status': 'CONFIRMED'}),
      MarketplacePaymentState.pending,
    );
    expect(
      marketplacePaymentState({
        'status': 'PENDING_PAYMENT',
        'paymentVerifiedAt': '2026-10-18T00:00:00Z',
      }),
      MarketplacePaymentState.pending,
    );
  });
  test('verified backend confirmation and cancellation recover safely', () {
    expect(
      marketplacePaymentState({
        'status': 'COMPLETED',
        'paymentVerifiedAt': '2026-10-18T00:00:00Z',
      }),
      MarketplacePaymentState.confirmed,
    );
    expect(
      marketplacePaymentState({'status': 'CANCELLED'}),
      MarketplacePaymentState.cancelled,
    );
  });
  for (final width in [360.0, 768.0]) {
    testWidgets(
      'delivery address selection at $width returns exact backend ID',
      (tester) async {
        tester.view.physicalSize = Size(width, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        Map<String, dynamic>? selected;
        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                body: TextButton(
                  onPressed: () async {
                    selected = await showModalBottomSheet<Map<String, dynamic>>(
                      context: context,
                      builder: (_) => const MarketplaceAddressPicker(
                        addresses: [
                          {
                            'id': 'first',
                            'fullName': 'Synthetic One',
                            'city': 'Synthetic',
                            'isDefault': true,
                          },
                          {
                            'id': 'second',
                            'fullName': 'Synthetic Two',
                            'city': 'Synthetic',
                          },
                        ],
                      ),
                    );
                  },
                  child: const Text('Select'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Select'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Synthetic Two'));
        await tester.pumpAndSettle();
        expect(selected?['id'], 'second');
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('cancel does not choose default address or start checkout', (
    tester,
  ) async {
    Map<String, dynamic>? selected;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () async {
                selected = await showModalBottomSheet<Map<String, dynamic>>(
                  context: context,
                  builder: (_) => const MarketplaceAddressPicker(
                    addresses: [
                      {'id': 'a', 'fullName': 'Synthetic', 'isDefault': true},
                    ],
                  ),
                );
              },
              child: const Text('Select'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Select'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(selected, isNull);
  });
}
