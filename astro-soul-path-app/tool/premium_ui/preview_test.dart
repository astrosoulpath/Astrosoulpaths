import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/celestial_feature_tile.dart';
import 'package:astro_soul_path/core/branding/premium_customer_surfaces.dart';

void main() {
  testWidgets('offline Explore widget preview', (tester) async {
    await tester.runAsync(() async {
      final loader = FontLoader('Roboto');
      loader.addFont(
        Future.value(
          ByteData.sublistView(
            File('C:/Windows/Fonts/segoeui.ttf').readAsBytesSync(),
          ),
        ),
      );
      await loader.load();
      final icons = FontLoader('MaterialIcons');
      icons.addFont(
        Future.value(
          ByteData.sublistView(
            File(
              'C:/src/flutter/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
            ).readAsBytesSync(),
          ),
        ),
      );
      await icons.load();
    });
    tester.view.physicalSize = const Size(780, 600);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final key = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(390, 300),
            disableAnimations: true,
          ),
          child: RepaintBoundary(
            key: key,
            child: Scaffold(
              backgroundColor: const Color(0xFFFFF9F1),
              body: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final feature in CelestialFeature.values)
                      Expanded(
                        child: CelestialFeatureTile(
                          feature: feature,
                          label: const [
                            'Kundli AI',
                            'Horoscope',
                            'AI Astro',
                            'Predictions',
                          ][feature.index],
                          onTap: () {},
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      for (final feature in CelestialFeature.values) {
        await precacheImage(
          ResizeImage(AssetImage(feature.assetPath), width: 256),
          key.currentContext!,
        );
      }
    });
    await tester.pumpAndSettle();
    final boundary =
        key.currentContext!.findRenderObject() as RenderRepaintBoundary;
    await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File(
        '../review/flutter-premium-ui/explore-${const String.fromEnvironment('PREVIEW_STAGE', defaultValue: 'after')}.png',
      ).writeAsBytesSync(bytes!.buffer.asUint8List());
      image.dispose();
    });
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('offline category and section composition', (tester) async {
    tester.view.physicalSize = const Size(780, 2000);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final key = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        home: RepaintBoundary(
          key: key,
          child: Scaffold(
            backgroundColor: premiumIvory,
            body: ListView(
              children: [
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text(
                    'Astro Soul Path',
                    style: TextStyle(
                      color: premiumInk,
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                SizedBox(
                  height: 148,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    children: [
                      for (final name in [
                        'career',
                        'marriage',
                        'stock_market',
                        'today',
                        'business',
                      ])
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: PremiumCategoryTile(
                            assetPath:
                                'assets/stickers/home_astrology/$name-premium.webp',
                            label: const {
                              'career': 'Career',
                              'marriage': 'Marriage',
                              'stock_market': 'Stock Market',
                              'today': 'Today',
                              'business': 'Business',
                            }[name]!,
                            onTap: () {},
                          ),
                        ),
                    ],
                  ),
                ),
                PremiumSectionBanner(
                  title: 'AI Astrologers',
                  subtitle: 'Personalized AI guidance with your Kundli',
                  assetPath:
                      'assets/stickers/home_astrology/ai-section-premium.webp',
                  icon: Icons.auto_awesome_rounded,
                  onTap: () {},
                ),
                PremiumSectionBanner(
                  title: 'Real Astrologers',
                  subtitle:
                      'Explore astrologer profiles, availability and consultation options.',
                  assetPath:
                      'assets/stickers/home_astrology/real-section-premium.webp',
                  icon: Icons.support_agent_rounded,
                  onTap: () {},
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.runAsync(() async {
      for (final name in [
        'career',
        'marriage',
        'stock_market',
        'today',
        'business',
      ]) {
        await precacheImage(
          ResizeImage(
            AssetImage('assets/stickers/home_astrology/$name-premium.webp'),
            width: 256,
          ),
          key.currentContext!,
        );
      }
      for (final name in ['ai-section', 'real-section']) {
        await precacheImage(
          AssetImage('assets/stickers/home_astrology/$name-premium.webp'),
          key.currentContext!,
        );
      }
    });
    await tester.pumpAndSettle();
    await tester.runAsync(() async {
      final image =
          await (key.currentContext!.findRenderObject()
                  as RenderRepaintBoundary)
              .toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File(
        '../review/flutter-premium-ui/sections-after.png',
      ).writeAsBytesSync(bytes!.buffer.asUint8List());
      image.dispose();
    });
    await tester.pumpWidget(const SizedBox());
  });
}
