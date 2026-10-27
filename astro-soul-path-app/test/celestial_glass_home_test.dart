import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/celestial_glass_home.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/compact_astrology_sticker.dart';
import 'package:astro_soul_path/features/customer/presentation/screens/customer_home_screen.dart';
import 'package:astro_soul_path/features/ai_astro/data/ai_astro_models.dart';

Widget host(Widget child, {bool reduced = false, double scale = 1}) =>
    MaterialApp(
      home: MediaQuery(
        data: MediaQueryData(
          size: const Size(320, 1100),
          disableAnimations: reduced,
          textScaler: TextScaler.linear(scale),
        ),
        child: Scaffold(body: child),
      ),
    );
Animation<double> clock(WidgetTester tester) =>
    (tester
                .widget<CustomPaint>(
                  find.byKey(const ValueKey('celestial-zodiac-ring')),
                )
                .painter!
            as CelestialZodiacPainter)
        .motion;

void main() {
  testWidgets('hero retains CTA, text and narrow large-text layout', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 1100);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var taps = 0;
    await tester.pumpWidget(
      host(
        SingleChildScrollView(
          child: CelestialHomeHero(onExplore: () => taps++),
        ),
        reduced: true,
        scale: 1.8,
      ),
    );
    await tester.pump();
    expect(find.text('Find Clarity'), findsOneWidget);
    await tester.ensureVisible(find.text('Explore Your Path'));
    await tester.tap(find.text('Explore Your Path'));
    expect(taps, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'ring advances linearly in 40 seconds; center moon stays a separate stationary widget',
    (tester) async {
      await tester.pumpWidget(host(const CelestialZodiacWheel()));
      await tester.pump();
      final start = clock(tester).value;
      await tester.pump(const Duration(seconds: 10));
      expect(clock(tester).value - start, closeTo(.25, .01));
      expect(find.byIcon(Icons.nightlight_round), findsOneWidget);
      expect(
        find.descendant(
          of: find.byType(CelestialZodiacWheel),
          matching: find.byType(RotationTransition),
        ),
        findsNothing,
      );
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('reduced motion prevents rotation', (tester) async {
    await tester.pumpWidget(host(const CelestialZodiacWheel(), reduced: true));
    await tester.pump();
    await tester.pump(const Duration(seconds: 12));
    expect(clock(tester).value, 0);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'background pauses and resume restarts; disposal leaves no ticker',
    (tester) async {
      await tester.pumpWidget(host(const CelestialZodiacWheel()));
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      final paused = clock(tester).value;
      await tester.pump(const Duration(seconds: 10));
      expect(clock(tester).value, paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pump();
      await tester.pump(const Duration(seconds: 2));
      expect(clock(tester).value, greaterThan(paused));
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('offscreen zodiac pauses after scrolling', (tester) async {
    await tester.pumpWidget(
      host(
        SingleChildScrollView(
          child: Column(
            children: const [CelestialZodiacWheel(), SizedBox(height: 2000)],
          ),
        ),
      ),
    );
    await tester.pump();
    await tester.drag(
      find.byType(SingleChildScrollView),
      const Offset(0, -650),
    );
    await tester.pump(const Duration(seconds: 1));
    final stopped = clock(tester).value;
    await tester.pump(const Duration(seconds: 3));
    expect(clock(tester).value, stopped);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'glass scope preserves labels, callbacks and circular Horoscope',
    (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          HomeStickerMotion(
            glassStyle: true,
            child: CompactAstrologySticker(
              kind: HomeSticker.horoscope,
              label: 'Horoscope',
              onTap: () => taps++,
            ),
          ),
          reduced: true,
        ),
      );
      await tester.pump();
      expect(find.byType(CelestialZodiacWheel), findsOneWidget);
      await tester.tap(find.text('Horoscope'));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'AI card identifies AI without fabricated verification or absent rating',
    (tester) async {
      final persona = AiAstroPersona.fromJson({
        'id': 'synthetic',
        'name': 'Synthetic AI',
        'initials': 'SA',
        'available': true,
      });
      await tester.pumpWidget(
        host(
          SizedBox(
            width: 155,
            child: HomeAiAstrologerStickerCard(persona: persona),
          ),
        ),
      );
      expect(find.text('AI ASTROLOGER'), findsOneWidget);
      expect(find.text('Verified'), findsNothing);
      expect(find.text('0.0'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
