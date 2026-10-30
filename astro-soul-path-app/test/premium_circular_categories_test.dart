import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/premium_customer_surfaces.dart';

const _categories = {
  'career': 'Career',
  'marriage': 'Marriage',
  'stock_market': 'Stock Market',
  'today': 'Today',
  'business': 'Business',
};

void main() {
  for (final width in [320.0, 390.0, 430.0, 600.0]) {
    for (final scale in [1.0, 2.0, 3.2]) {
      testWidgets('one circular carousel at $width / text scale $scale', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final taps = <String>[];
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(
                size: Size(width, 800),
                textScaler: TextScaler.linear(scale),
                disableAnimations: true,
              ),
              child: Scaffold(
                body: Builder(
                  builder: (context) => SizedBox(
                    height: PremiumCategoryTile.carouselHeight(
                      context,
                      _categories.values.toList(),
                    ),
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final entry in _categories.entries)
                          PremiumCategoryTile(
                            assetPath:
                                'assets/stickers/home_astrology/${entry.key}-circular-v1.png',
                            label: entry.value,
                            onTap: () => taps.add(entry.key),
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
        expect(find.byType(ListView), findsOneWidget);
        for (final entry in _categories.entries) {
          final label = find.text(entry.value);
          expect(label, findsOneWidget);
          await Scrollable.ensureVisible(tester.element(label), alignment: .5);
          await tester.pumpAndSettle();
          final tile = find.ancestor(
            of: label,
            matching: find.byType(PremiumCategoryTile),
          );
          final artwork = find.descendant(
            of: tile,
            matching: find.byType(ClipOval),
          );
          expect(artwork, findsOneWidget);
          expect(tester.getSize(artwork).width, inInclusiveRange(64.0, 72.0));
          expect(tester.getSize(artwork).height, tester.getSize(artwork).width);
          await tester.tap(artwork);
          await tester.tap(label);
          expect(tester.takeException(), isNull);
        }
        expect(taps, [
          for (final key in _categories.keys) ...[key, key],
        ]);
      });
    }
  }
  testWidgets('localized RTL label remains a single accessible button', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    const label = 'سوق الأسهم';
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Directionality(
          textDirection: TextDirection.rtl,
          child: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 700),
              textScaler: TextScaler.linear(3),
            ),
            child: Scaffold(
              body: Builder(
                builder: (context) => SizedBox(
                  height: PremiumCategoryTile.carouselHeight(context, const [
                    label,
                  ]),
                  child: Row(
                    children: [
                      PremiumCategoryTile(
                        assetPath:
                            'assets/stickers/home_astrology/stock_market-circular-v1.png',
                        label: label,
                        onTap: () => taps++,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(label), findsOneWidget);
    expect(
      tester
          .getSemantics(find.bySemanticsLabel(label))
          .getSemanticsData()
          .flagsCollection
          .isButton,
      isTrue,
    );
    await tester.tap(find.text(label));
    expect(taps, 1);
    expect(tester.takeException(), isNull);
    semantics.dispose();
  });
}
