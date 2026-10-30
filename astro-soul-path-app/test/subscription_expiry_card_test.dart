import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/notifications/presentation/screens/subscription_notifications_screen.dart';

Map<String, dynamic> fixture(
  String role, {
  String status = 'ACTIVE',
  bool period = true,
}) => {
  'roleContext': role,
  'serverNow': '2026-10-30T12:00:00Z',
  'product': {
    'title': role == 'CUSTOMER'
        ? 'Personalized Daily Horoscope'
        : 'Professional Kundli',
  },
  'subscription': {
    'id': 'synthetic',
    'status': status,
    'startDate': period ? '2026-10-07T12:00:00Z' : null,
    'expiresAt': period ? '2026-11-06T12:00:00Z' : null,
  },
};
void main() {
  for (final role in ['CUSTOMER', 'ASTROLOGER']) {
    testWidgets('$role shows authoritative expiry and correct renewal', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: SubscriptionExpiryCard(
                data: fixture(role),
                onRenew: () => taps++,
              ),
            ),
          ),
        ),
      );
      expect(find.text('7 days remaining'), findsOneWidget);
      expect(find.textContaining('Expires '), findsOneWidget);
      expect(
        find.text(
          role == 'CUSTOMER'
              ? 'Renew for \$1'
              : 'Renew Professional Kundli · ₹3,500',
        ),
        findsOneWidget,
      );
      await tester.tap(find.byType(FilledButton));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
    });
  }
  for (final width in [320.0, 390.0, 430.0]) {
    testWidgets('responsive card at $width with large accessible text', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 1000),
              textScaler: const TextScaler.linear(2),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: SingleChildScrollView(
                child: SubscriptionExpiryCard(data: fixture('ASTROLOGER')),
              ),
            ),
          ),
        ),
      );
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('missing or pending period never fabricates countdown', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SubscriptionExpiryCard(
            data: fixture('CUSTOMER', status: 'PENDING', period: false),
          ),
        ),
      ),
    );
    expect(find.text('PENDING'), findsOneWidget);
    expect(find.textContaining('days remaining'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsNothing);
  });
  testWidgets('expired astrologer explains access without customer copy', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SubscriptionExpiryCard(
            data: fixture('ASTROLOGER', status: 'EXPIRED'),
          ),
        ),
      ),
    );
    expect(
      find.text('Renew to resume authorized Professional Kundli generation.'),
      findsOneWidget,
    );
    expect(find.text('Renew for \$1'), findsNothing);
  });
}
