// Explicit offline asset build: flutter test tool/branding/export_brand_assets_test.dart
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/brand_emblem.dart';
import 'package:astro_soul_path/core/branding/celestial_feature_tile.dart';
import 'package:astro_soul_path/core/branding/premium_startup_splash.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('export original vector brand at native platform resolutions', () async {
    final font = File('C:/Windows/Fonts/segoeui.ttf');
    if (font.existsSync()) {
      await (FontLoader('SheetSans')..addFont(
            Future.value(ByteData.sublistView(font.readAsBytesSync())),
          ))
          .load();
    }
    Future<void> png(
      String path,
      int size, {
      bool background = true,
      double emblem = .84,
      bool monochrome = false,
    }) async {
      final recorder = ui.PictureRecorder(), canvas = Canvas(recorder);
      if (background) {
        canvas.drawColor(brandNavy, BlendMode.src);
      }
      canvas.save();
      canvas.translate(size * (1 - emblem) / 2, size * (1 - emblem) / 2);
      BrandEmblemPainter(
        monochrome: monochrome,
      ).paint(canvas, Size.square(size * emblem));
      canvas.restore();
      final picture = recorder.endRecording(),
          image = await picture.toImage(size, size),
          bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      File(path).parent.createSync(recursive: true);
      File(path).writeAsBytesSync(bytes!.buffer.asUint8List());
      image.dispose();
      picture.dispose();
    }

    await png('assets/branding/astro_soul_path_icon_1024.png', 1024);
    for (final density in {
      'mdpi': 48,
      'hdpi': 72,
      'xhdpi': 96,
      'xxhdpi': 144,
      'xxxhdpi': 192,
    }.entries) {
      await png(
        'android/app/src/main/res/mipmap-${density.key}/ic_launcher.png',
        density.value,
      );
    }
    // 60/108 diameter fits entirely within Android's 66/108 adaptive safe circle.
    await png(
      'android/app/src/main/res/drawable-nodpi/ic_launcher_foreground.png',
      432,
      background: false,
      emblem: 60 / 108,
    );
    await png(
      'android/app/src/main/res/drawable-nodpi/ic_launcher_monochrome.png',
      432,
      background: false,
      emblem: 60 / 108,
      monochrome: true,
    );
    await png(
      'android/app/src/main/res/drawable-nodpi/brand_splash.png',
      864,
      background: false,
      emblem: 180 / 288,
    );
    await png(
      'android/app/src/main/res/drawable-nodpi/ic_stat_astro.png',
      96,
      background: false,
      emblem: .84,
      monochrome: true,
    );
    final catalog =
        jsonDecode(
              File(
                'ios/Runner/Assets.xcassets/AppIcon.appiconset/Contents.json',
              ).readAsStringSync(),
            )
            as Map<String, dynamic>;
    for (final item in catalog['images'] as List) {
      final name = item['filename'] as String?;
      if (name == null) {
        continue;
      }
      final points = double.parse((item['size'] as String).split('x').first),
          scale = double.parse((item['scale'] as String).replaceAll('x', ''));
      await png(
        'ios/Runner/Assets.xcassets/AppIcon.appiconset/$name',
        (points * scale).round(),
      );
    }
    for (var scale = 1; scale <= 3; scale++) {
      await png(
        'ios/Runner/Assets.xcassets/LaunchImage.imageset/LaunchImage${scale == 1 ? '' : '@${scale}x'}.png',
        144 * scale,
        background: false,
        emblem: 1,
      );
    }
    final recorder = ui.PictureRecorder(), canvas = Canvas(recorder);
    canvas.drawColor(const Color(0xFFF5F0E6), BlendMode.src);
    void label(String s, Offset position, {double size = 16}) {
      final p = TextPainter(
        text: TextSpan(
          text: s,
          style: TextStyle(
            fontFamily: 'SheetSans',
            color: brandNavy,
            fontSize: size,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      p.paint(canvas, position);
    }

    label(
      'ASTRO SOUL PATH / NATIVE VECTOR BRAND',
      const Offset(32, 22),
      size: 23,
    );
    const titles = [
      'Android circle',
      'Adaptive rounded',
      'Android small',
      'iOS home',
      'iOS small',
    ];
    for (var i = 0; i < 5; i++) {
      final x = 32.0 + i * 206;
      label(titles[i], Offset(x, 78));
      final n = i == 2 || i == 4 ? 48.0 : 152.0,
          box = Rect.fromLTWH(x + (152 - n) / 2, 120 + (152 - n) / 2, n, n);
      canvas.save();
      if (i == 0 || i == 2) {
        canvas.clipPath(Path()..addOval(box));
      } else {
        canvas.clipRRect(
          RRect.fromRectAndRadius(box, Radius.circular(n * .23)),
        );
      }
      canvas.drawRect(box, Paint()..color = brandNavy);
      canvas.translate(box.left + n * .08, box.top + n * .08);
      const BrandEmblemPainter().paint(canvas, Size.square(n * .84));
      canvas.restore();
    }
    label(
      'EXPLORE ASTROLOGY / FOUR ORIGINAL PAINTED ICONS',
      const Offset(32, 320),
      size: 20,
    );
    const names = ['Kundli AI', 'Horoscope', 'AI Astro', 'Predictions'];
    for (var i = 0; i < 4; i++) {
      canvas.save();
      canvas.translate(48 + i * 248.0, 370);
      CelestialFeaturePainter(
        CelestialFeature.values[i],
        const AlwaysStoppedAnimation(.3),
      ).paint(canvas, const Size.square(152));
      canvas.restore();
      label(names[i], Offset(48 + i * 248.0, 540));
    }
    final picture = recorder.endRecording(),
        image = await picture.toImage(1080, 600),
        bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    Directory('review/branding').createSync(recursive: true);
    File(
      'review/branding/icon-contact-sheet.png',
    ).writeAsBytesSync(bytes!.buffer.asUint8List());
    image.dispose();
    picture.dispose();
  });
  testWidgets(
    'capture actual Flutter splash and feature widgets without accounts',
    (tester) async {
      await tester.runAsync(() async {
        for (final entry in {
          'SheetSans': 'segoeui.ttf',
          'serif': 'times.ttf',
        }.entries) {
          final f = File('C:/Windows/Fonts/${entry.value}');
          if (f.existsSync()) {
            await (FontLoader(entry.key)..addFont(
                  Future.value(ByteData.sublistView(f.readAsBytesSync())),
                ))
                .load();
          }
        }
      });
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      Future<void> capture(Widget body, String name) async {
        final key = GlobalKey();
        await tester.pumpWidget(
          RepaintBoundary(
            key: key,
            child: MaterialApp(
              debugShowCheckedModeBanner: false,
              theme: ThemeData(fontFamily: 'SheetSans'),
              home: MediaQuery(
                data: const MediaQueryData(
                  size: Size(390, 844),
                  disableAnimations: true,
                ),
                child: body,
              ),
            ),
          ),
        );
        await tester.pump();
        await tester.runAsync(() async {
          final image =
              await (key.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage(pixelRatio: 2);
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          File(
            'review/branding/$name.png',
          ).writeAsBytesSync(bytes!.buffer.asUint8List());
          image.dispose();
        });
      }

      await capture(const PremiumStartupSplash(), 'flutter-splash-preview');
      await capture(
        Scaffold(
          backgroundColor: brandNavy,
          body: SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 40),
                  const Text(
                    'Explore Astrology',
                    style: TextStyle(color: brandGold, fontSize: 25),
                  ),
                  const SizedBox(height: 30),
                  Row(
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
                  const SizedBox(height: 32),
                  const Text(
                    'Flutter widget preview — no customer data',
                    style: TextStyle(color: Color(0xFFC3BDD9), fontSize: 12),
                  ),
                ],
              ),
            ),
          ),
        ),
        'flutter-feature-preview',
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
