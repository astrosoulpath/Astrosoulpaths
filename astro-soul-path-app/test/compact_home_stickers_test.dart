import 'dart:ui' show SemanticsAction;
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/compact_astrology_sticker.dart';

const labels = [
  'Kundli AI',
  'Horoscope',
  'AI Astro',
  'Talk to Astrologer',
  'Match',
  'Career',
  'Love',
  'Marriage',
  'Prediction',
];
void main() {
  testWidgets(
    'narrow four-column artwork stays square rather than stretching',
    (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(disableAnimations: true),
            child: Scaffold(
              body: SizedBox(
                width: 60,
                child: CompactAstrologySticker(
                  kind: HomeSticker.kundli,
                  label: 'Kundli AI',
                  onTap: () => taps++,
                ),
              ),
            ),
          ),
        ),
      );
      final paint = find.descendant(
        of: find.byType(CompactAstrologySticker),
        matching: find.byType(CustomPaint),
      );
      final size = tester.getSize(paint);
      expect(size.width, size.height);
      expect(size.width, 48);
      expect(
        tester.getSize(find.byType(CompactAstrologySticker)).width,
        greaterThanOrEqualTo(48),
      );
      await tester.tap(find.text('Kundli AI'));
      await tester.tap(find.text('Kundli AI'));
      expect(taps, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets(
    'nine cutout stickers retain visible labels and callbacks at 320px and large text',
    (tester) async {
      final semantics = tester.ensureSemantics();
      tester.view.physicalSize = const Size(320, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final taps = <HomeSticker>[];
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 1000),
              disableAnimations: true,
              textScaler: TextScaler.linear(1.6),
            ),
            child: Scaffold(
              body: SingleChildScrollView(
                child: Wrap(
                  children: [
                    for (final kind in HomeSticker.values)
                      SizedBox(
                        width: 100,
                        child: CompactAstrologySticker(
                          kind: kind,
                          label: labels[kind.index],
                          onTap: () => taps.add(kind),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(tester.takeException(), isNull);
      for (final label in labels) {
        expect(find.text(label), findsOneWidget);
        await tester.tap(find.text(label));
      }
      expect(taps, HomeSticker.values);
      expect(find.byType(Image), findsNothing);
      final materials = tester.widgetList<Material>(
        find.descendant(
          of: find.byType(CompactAstrologySticker),
          matching: find.byType(Material),
        ),
      );
      expect(materials.every((m) => m.color == Colors.transparent), isTrue);
      expect(find.byType(CompactAstrologySticker), findsNWidgets(9));
      for (final sticker in find.byType(CompactAstrologySticker).evaluate()) {
        expect(
          tester
              .getSemantics(find.byWidget(sticker.widget))
              .getSemanticsData()
              .hasAction(SemanticsAction.tap),
          isTrue,
        );
      }
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
      semantics.dispose();
    },
  );

  testWidgets('motion stops while paused and disposes cleanly', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: HomeStickerMotion(
            child: CompactAstrologySticker(
              kind: HomeSticker.ai,
              label: 'AI Astro',
              onTap: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpWidget(const SizedBox());
    expect(tester.takeException(), isNull);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
  });

  testWidgets(
    'all nine painters share one clock and pause for reduced motion',
    (tester) async {
      Widget gallery(bool reduced) => MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: reduced),
          child: HomeStickerMotion(
            child: Scaffold(
              body: Wrap(
                children: [
                  for (final kind in HomeSticker.values)
                    SizedBox(
                      width: 90,
                      child: CompactAstrologySticker(
                        kind: kind,
                        label: labels[kind.index],
                        onTap: () {},
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpWidget(gallery(false));
      List<AstrologyStickerPainter> painters() => tester
          .widgetList<CustomPaint>(find.byType(CustomPaint))
          .map((p) => p.painter)
          .whereType<AstrologyStickerPainter>()
          .toList();
      expect(painters(), hasLength(9));
      final clock = painters().first.motion;
      expect(painters().every((p) => identical(p.motion, clock)), isTrue);
      await tester.pump(const Duration(seconds: 2));
      final previous = clock.value;
      await tester.pump(const Duration(seconds: 2));
      expect(clock.value, greaterThan(previous));
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      final paused = clock.value;
      await tester.pump(const Duration(seconds: 2));
      expect(clock.value, paused);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(gallery(true));
      expect(painters().every((p) => p.motion.value == 0), isTrue);
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
}
