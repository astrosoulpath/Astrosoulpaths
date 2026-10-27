import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/brand_emblem.dart';
import 'package:astro_soul_path/core/branding/premium_startup_splash.dart';
import 'package:astro_soul_path/core/branding/celestial_feature_tile.dart';
import 'package:astro_soul_path/core/branding/brand_startup_transition.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/presentation/auth_gate.dart';
import 'package:astro_soul_path/features/auth/presentation/screens/welcome_screen.dart';

class NoSession extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async => null;
}

Widget features({
  bool reduced = false,
  void Function(CelestialFeature)? onTap,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(
      size: const Size(800, 600),
      disableAnimations: reduced,
    ),
    child: Scaffold(
      backgroundColor: brandNavy,
      body: Row(
        children: CelestialFeature.values
            .map(
              (f) => Expanded(
                child: CelestialFeatureTile(
                  feature: f,
                  label: const [
                    'Kundli AI',
                    'Horoscope',
                    'AI Astro',
                    'Predictions',
                  ][f.index],
                  onTap: () => onTap?.call(f),
                ),
              ),
            )
            .toList(),
      ),
    ),
  ),
);
void main() {
  testWidgets(
    'startup fades only to caller-selected content, without inventing a route',
    (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: BrandStartupTransition(
            child: Text('Initializing', key: ValueKey('loading')),
          ),
        ),
      );
      await tester.pumpWidget(
        const MaterialApp(
          home: BrandStartupTransition(
            child: Text('Verified destination', key: ValueKey('ready')),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Verified destination'), findsOneWidget);
      expect(find.text('Initializing'), findsNothing);
    },
  );
  testWidgets(
    'offscreen feature animation stops and resumes only when visible',
    (tester) async {
      final scroll = ScrollController();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              controller: scroll,
              child: Column(
                children: [
                  const SizedBox(height: 900),
                  CelestialFeatureTile(
                    feature: CelestialFeature.kundli,
                    label: 'Kundli AI',
                    onTap: () {},
                  ),
                  const SizedBox(height: 900),
                ],
              ),
            ),
          ),
        ),
      );
      final painter = tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<CelestialFeaturePainter>()
          .first;
      await tester.pump(const Duration(milliseconds: 100));
      expect(painter.animation.value, 0);
      scroll.jumpTo(900);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 100));
      expect(painter.animation.value, greaterThan(0));
      scroll.jumpTo(0);
      await tester.pump();
      final stopped = painter.animation.value;
      await tester.pump(const Duration(seconds: 1));
      expect(painter.animation.value, stopped);
      await tester.pumpWidget(const SizedBox.shrink());
      scroll.dispose();
    },
  );
  testWidgets(
    'splash animates once then holds, disposes without a ticker leak',
    (tester) async {
      await tester.pumpWidget(const MaterialApp(home: PremiumStartupSplash()));
      expect(find.byType(BrandEmblem), findsOneWidget);
      await tester.pump(const Duration(milliseconds: 1900));
      await tester.pumpAndSettle();
      expect(find.text('Astro Soul Path'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('reduced motion splash is immediately legible and static', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: PremiumStartupSplash(),
        ),
      ),
    );
    final opacity = tester.widget<Opacity>(find.byType(Opacity).first);
    expect(opacity.opacity, 1);
    await tester.pumpAndSettle();
    expect(tester.binding.hasScheduledFrame, isFalse);
  });
  for (final width in [320.0, 390.0, 768.0]) {
    testWidgets('four distinct readable feature tiles at $width, large text', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 900);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 900),
              textScaler: TextScaler.linear(1.8),
              disableAnimations: true,
            ),
            child: Scaffold(
              body: Row(
                children: CelestialFeature.values
                    .map(
                      (f) => Expanded(
                        child: CelestialFeatureTile(
                          feature: f,
                          label: const [
                            'Kundli AI',
                            'Horoscope',
                            'AI Astro',
                            'Predictions',
                          ][f.index],
                          onTap: () {},
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        ),
      );
      expect(find.byType(CelestialFeatureTile), findsNWidgets(4));
      expect(tester.takeException(), isNull);
      final painters = tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((w) => w.painter)
          .whereType<CelestialFeaturePainter>()
          .map((p) => p.feature)
          .toSet();
      expect(painters.length, 4);
    });
  }
  testWidgets(
    'each callback opens its original supplied destination only once during rapid taps',
    (tester) async {
      final taps = <CelestialFeature>[];
      await tester.pumpWidget(features(reduced: true, onTap: taps.add));
      for (final f in CelestialFeature.values) {
        final tile = find.byType(CelestialFeatureTile).at(f.index);
        await tester.tap(tile);
        await tester.tap(tile);
      }
      expect(taps, CelestialFeature.values);
      await tester.pump(const Duration(milliseconds: 710));
      await tester.tap(find.byType(CelestialFeatureTile).first);
      expect(taps.length, 5);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets('ambient animation pauses in background and reduced motion', (
    tester,
  ) async {
    await tester.pumpWidget(features());
    await tester.pump(const Duration(milliseconds: 100));
    final painter = tester
        .widgetList<CustomPaint>(find.byType(CustomPaint))
        .map((w) => w.painter)
        .whereType<CelestialFeaturePainter>()
        .first;
    final before = painter.animation.value;
    await tester.pump(const Duration(milliseconds: 100));
    expect(painter.animation.value, greaterThan(before));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    final stopped = painter.animation.value;
    await tester.pump(const Duration(seconds: 1));
    expect(painter.animation.value, stopped);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpWidget(features(reduced: true));
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
  testWidgets(
    'signed-out AuthGate retains existing Welcome and Continue/Skip flow',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(home: AuthGate(sessionStore: NoSession())),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byType(WelcomeScreen), findsOneWidget);
      expect(find.text('Your stars.\nYour path.'), findsOneWidget);
      await tester.tap(find.text('Continue'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump();
      expect(find.text('Talk to trusted\nastrologers.'), findsOneWidget);
      await tester.tap(find.text('Skip'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump();
      expect(find.text('Continue as Customer'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
