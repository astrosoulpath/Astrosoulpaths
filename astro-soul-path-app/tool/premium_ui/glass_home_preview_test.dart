import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/celestial_glass_home.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/compact_astrology_sticker.dart';
import 'package:astro_soul_path/core/branding/premium_customer_surfaces.dart';

// Offline component evidence only. Never authenticates or contacts an API.
void main() {
  for (final width in [390.0, 768.0]) {
    testWidgets('offline glass components ${width.toInt()}', (tester) async {
      await tester.runAsync(() async {
        for (final entry in {
          'Roboto': 'C:/Windows/Fonts/segoeui.ttf',
          'MaterialIcons':
              'C:/src/flutter/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
        }.entries) {
          final loader = FontLoader(entry.key)
            ..addFont(
              Future.value(
                ByteData.sublistView(File(entry.value).readAsBytesSync()),
              ),
            );
          await loader.load();
        }
      });
      tester.view.physicalSize = Size(width, 1550);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final boundary = GlobalKey();
      const labels = [
        'Kundli AI',
        'Horoscope',
        'AI Astro',
        'Prediction',
        'Talk to Astrologer',
        'Match',
        'Love',
        'Career',
      ];
      const kinds = [
        HomeSticker.kundli,
        HomeSticker.horoscope,
        HomeSticker.ai,
        HomeSticker.prediction,
        HomeSticker.talk,
        HomeSticker.match,
        HomeSticker.love,
        HomeSticker.career,
      ];
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 1550),
              disableAnimations: true,
            ),
            child: Scaffold(
              backgroundColor: CelestialHomeStyle.ivory,
              body: RepaintBoundary(
                key: boundary,
                child: ColoredBox(
                  color: CelestialHomeStyle.ivory,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: HomeStickerMotion(
                      glassStyle: true,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'OFFLINE COMPONENT FIXTURE — NOT EMULATOR E2E',
                            style: TextStyle(
                              fontSize: 10,
                              color: CelestialHomeStyle.ink,
                            ),
                          ),
                          const SizedBox(height: 12),
                          CelestialHomeHero(onExplore: () {}),
                          const SizedBox(height: 24),
                          const Text(
                            'Explore astrology',
                            style: TextStyle(
                              fontSize: 23,
                              color: CelestialHomeStyle.ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          for (var row = 0; row < 2; row++)
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                for (var col = 0; col < 4; col++)
                                  Expanded(
                                    child: CompactAstrologySticker(
                                      kind: kinds[row * 4 + col],
                                      label: labels[row * 4 + col],
                                      onTap: () {},
                                    ),
                                  ),
                              ],
                            ),
                          const SizedBox(height: 24),
                          const Text(
                            'Existing category artwork',
                            style: TextStyle(
                              fontSize: 22,
                              color: CelestialHomeStyle.ink,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 10,
                            runSpacing: 12,
                            children: [
                              for (final category in [
                                'career',
                                'marriage',
                                'stock_market',
                                'today',
                                'business',
                              ])
                                PremiumCategoryTile(
                                  assetPath:
                                      'assets/stickers/home_astrology/$category-premium.webp',
                                  label: category.replaceAll('_', ' '),
                                  onTap: () {},
                                ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'No live profiles, prices or ratings are mocked as real.',
                            style: TextStyle(color: CelestialHomeStyle.ink),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.runAsync(() async {
        for (final category in [
          'career',
          'marriage',
          'stock_market',
          'today',
          'business',
        ]) {
          await precacheImage(
            AssetImage('assets/stickers/home_astrology/$category-premium.webp'),
            boundary.currentContext!,
          );
        }
      });
      await tester.pump(const Duration(milliseconds: 100));
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final image =
            await (boundary.currentContext!.findRenderObject()!
                    as RenderRepaintBoundary)
                .toImage();
        final data = await image.toByteData(format: ui.ImageByteFormat.png);
        final output = File(
          '../review/ui/glass-home-components-${width.toInt()}.png',
        );
        output.parent.createSync(recursive: true);
        output.writeAsBytesSync(data!.buffer.asUint8List());
        image.dispose();
      });
      await tester.pumpWidget(const SizedBox());
    });
  }
}
