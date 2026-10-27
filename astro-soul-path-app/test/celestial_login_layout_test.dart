import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_portal.dart';
import 'package:astro_soul_path/features/auth/presentation/widgets/celestial_login_layout.dart';

void main() {
  for (final portal in AuthPortal.values) {
    for (final width in [320.0, 360.0, 412.0]) {
      testWidgets('$portal at $width and 2x text retains accessible actions', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 850);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var emails = 0;
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(
                size: Size(width, 850),
                textScaler: const TextScaler.linear(2),
                disableAnimations: true,
              ),
              child: CelestialLoginLayout(
                portal: portal,
                busy: false,
                onGoogle: () {},
                onEmail: () => emails++,
                onBack: () {},
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Continue with Google'), findsOneWidget);
        final expectedHeading = switch (portal) {
          AuthPortal.customer => 'Consult trusted astrologers.',
          AuthPortal.astrologer => 'Connect with seekers.',
          AuthPortal.joinAstrologer => 'Share your wisdom.',
        };
        final expectedTrust = switch (portal) {
          AuthPortal.customer => 'Your Data Safe',
          AuthPortal.astrologer => 'Grow Your Practice',
          AuthPortal.joinAstrologer => 'Grow Your Clients',
        };
        expect(find.text(expectedHeading), findsOneWidget);
        expect(find.text(expectedTrust), findsOneWidget);
        expect(find.text('Mobile Number'), findsNothing);
        await tester.ensureVisible(find.text('Continue with Email'));
        await tester.tap(find.text('Continue with Email'));
        expect(emails, 1);
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets(
    'opening animation does not block actions and busy disables both',
    (tester) async {
      var taps = 0;
      Future<void> show(bool busy) => tester.pumpWidget(
        MaterialApp(
          home: CelestialLoginLayout(
            portal: AuthPortal.customer,
            busy: busy,
            onGoogle: () => taps++,
            onEmail: () => taps++,
            onBack: () {},
          ),
        ),
      );
      await show(false);
      await tester.ensureVisible(find.text('Continue with Google'));
      await tester.tap(find.text('Continue with Google'));
      expect(taps, 1);
      await show(true);
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      expect(
        tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
        isNull,
      );
      await show(false);
      await tester.pumpAndSettle(const Duration(milliseconds: 100));
    },
  );
}
