import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/premium_customer_surfaces.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/curved_cosmic_home_header.dart';

const categories = {
  'career': 'Career',
  'marriage': 'Marriage',
  'stock_market': 'Stock Market',
  'today': 'Today',
  'business': 'Business',
};
void main() {
  for (final brightness in Brightness.values) {
    testWidgets('category text follows semantic color in $brightness', (
      tester,
    ) async {
      final ink = brightness == Brightness.dark
          ? const Color(0xFFF8F5FF)
          : premiumInk;
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            colorScheme: ColorScheme.fromSeed(
              seedColor: premiumGold,
              brightness: brightness,
            ).copyWith(onSurface: ink),
          ),
          home: Scaffold(
            body: PremiumCategoryTile(
              assetPath:
                  'assets/stickers/home_astrology/career-circular-v1.png',
              label: 'Career',
              onTap: () {},
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.widget<Text>(find.text('Career')).style?.color, ink);
      expect(tester.takeException(), isNull);
    });
  }
  test('header is 22.3 percent shorter without shrinking accessibility', () {
    final normal = CurvedCosmicHomeHeader(
      walletLabel: 'Test',
      unreadCount: 0,
      onWallet: () {},
      onNotifications: () {},
    );
    final large = CurvedCosmicHomeHeader(
      walletLabel: 'Test',
      unreadCount: 0,
      textScale: 2,
      onWallet: () {},
      onNotifications: () {},
    );
    expect(normal.preferredSize.height, 174);
    expect(large.preferredSize.height, 354);
    expect(
      (224 - normal.preferredSize.height) / 224,
      inInclusiveRange(.20, .25),
    );
  });
  for (final width in [360.0, 390.0, 412.0, 600.0]) {
    testWidgets(
      'borderless carousel retains art, order and callbacks at $width',
      (tester) async {
        tester.view.physicalSize = Size(width, 700);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final taps = <String>[];
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: MediaQuery(
                data: MediaQueryData(
                  size: Size(width, 700),
                  textScaler: const TextScaler.linear(2),
                ),
                child: Builder(
                  builder: (context) => SizedBox(
                    height: PremiumCategoryTile.carouselHeight(
                      context,
                      categories.values.toList(),
                    ),
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        for (final e in categories.entries)
                          PremiumCategoryTile(
                            assetPath:
                                'assets/stickers/home_astrology/${e.key}-circular-v1.png',
                            label: e.value,
                            onTap: () => taps.add(e.value),
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
        for (final e in categories.entries) {
          final f = find.text(e.value);
          await tester.scrollUntilVisible(
            f,
            100,
            scrollable: find.byType(Scrollable).first,
          );
          await Scrollable.ensureVisible(tester.element(f), alignment: .5);
          await tester.pump();
          await tester.tap(f);
          await tester.pump();
          final tile = find.ancestor(
            of: f,
            matching: find.byType(PremiumCategoryTile),
          );
          final material = tester.widget<Material>(
            find.descendant(of: tile, matching: find.byType(Material)).first,
          );
          expect(material.type, MaterialType.transparency);
          expect(material.shape, isNull);
          expect(material.elevation, 0);
          final image = tester.widget<Image>(
            find.descendant(of: tile, matching: find.byType(Image)),
          );
          expect(
            ((image.image as ResizeImage).imageProvider as AssetImage)
                .assetName,
            'assets/stickers/home_astrology/${e.key}-circular-v1.png',
          );
          expect(image.fit, BoxFit.contain);
        }
        expect(taps, categories.values.toList());
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('export synthetic compact preview and verify seamless lower edge', (
    tester,
  ) async {
    final config =
        jsonDecode(File('.dart_tool/package_config.json').readAsStringSync())
            as Map;
    final flutter = (config['packages'] as List).cast<Map>().firstWhere(
      (p) => p['name'] == 'flutter',
    );
    final sdk = Directory.fromUri(
      Uri.parse(flutter['rootUri'] as String),
    ).parent.parent.path;
    await tester.runAsync(() async {
      for (final e in {
        'PreviewRoboto': 'Roboto-Regular.ttf',
        'serif': 'Roboto-Regular.ttf',
        'MaterialIcons': 'materialicons-regular.otf',
      }.entries) {
        final bytes = File(
          '$sdk/bin/cache/artifacts/material_fonts/${e.value}',
        ).readAsBytesSync();
        await (FontLoader(
          e.key,
        )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
      }
    });
    tester.view.physicalSize = const Size(390, 450);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final key = GlobalKey();
    await tester.pumpWidget(
      MaterialApp(
        // This golden predates semantic theme tokens. Pin its documented navy
        // palette so a Material default color change is not a visual regression.
        // The production widget still follows the active light/dark onSurface.
        theme: ThemeData(
          fontFamily: 'PreviewRoboto',
          colorScheme: ColorScheme.fromSeed(
            seedColor: premiumGold,
          ).copyWith(onSurface: premiumInk),
        ),
        home: RepaintBoundary(
          key: key,
          child: ColoredBox(
            color: const Color(0xFFFFF9F1),
            child: Column(
              children: [
                SizedBox(
                  height: 174,
                  child: CurvedCosmicHomeHeader(
                    walletLabel: 'Test balance',
                    unreadCount: 2,
                    onWallet: () {},
                    onNotifications: () {},
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'SYNTHETIC WIDGET PREVIEW — NOT DEVICE E2E',
                  style: TextStyle(
                    color: Colors.black,
                    fontSize: 10,
                    fontFamily: 'PreviewRoboto',
                    decoration: TextDecoration.none,
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  height: 148,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: [
                      for (final e in categories.entries)
                        PremiumCategoryTile(
                          assetPath:
                              'assets/stickers/home_astrology/${e.key}-circular-v1.png',
                          label: e.value,
                          onTap: () {},
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.runAsync(() async {
      final boundary =
          key.currentContext!.findRenderObject()! as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 1);
      final raw = (await image.toByteData(format: ui.ImageByteFormat.rawRgba))!;
      // No cream rectangle or shadow is painted into the bottom row of header bounds.
      for (final x in [0, 100, 200, 389]) {
        final i = (173 * 390 + x) * 4;
        expect(raw.getUint8(i), 255);
        expect(raw.getUint8(i + 1), 249);
        expect(raw.getUint8(i + 2), 241);
      }
      final bytes = (await image.toByteData(format: ui.ImageByteFormat.png))!;
      final file = File(
        '../review/ui/screenshots/premium-circular-home-synthetic-preview.png',
      );
      file.parent.createSync(recursive: true);
      file.writeAsBytesSync(bytes.buffer.asUint8List());
      image.dispose();
      final corners = <String, dynamic>{};
      for (final asset in categories.keys) {
        final codec = await ui.instantiateImageCodec(
          File(
            'assets/stickers/home_astrology/$asset-circular-v1.png',
          ).readAsBytesSync(),
        );
        final frame = await codec.getNextFrame();
        final data = (await frame.image.toByteData(
          format: ui.ImageByteFormat.rawRgba,
        ))!;
        corners[asset] = {
          'topLeftRgba': List.generate(4, data.getUint8),
          'width': frame.image.width,
          'height': frame.image.height,
        };
        frame.image.dispose();
        codec.dispose();
      }
      File(
        '../review/ui/premium-circular-artwork-corner-inspection.json',
      ).writeAsStringSync(jsonEncode(corners));
    });
    await expectLater(
      find.byKey(key),
      matchesGoldenFile('goldens/circular_home_components.png'),
    );
  });
}
