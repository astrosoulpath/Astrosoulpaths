import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/curved_cosmic_home_header.dart';

void main() {
  for (final width in [360.0, 390.0, 412.0, 600.0]) {
    for (final scale in [1.0, 2.0]) {
      testWidgets('header fits $width at text scale $scale', (tester) async {
        tester.view.physicalSize = Size(width, 850);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        var wallets = 0, notifications = 0;
        await tester.pumpWidget(
          MaterialApp(
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(
                textScaler: TextScaler.linear(scale),
                padding: const EdgeInsets.only(top: 28),
              ),
              child: child!,
            ),
            home: Scaffold(
              drawer: const Drawer(child: Text('Existing drawer')),
              appBar: CurvedCosmicHomeHeader(
                walletLabel: '₹42.75',
                unreadCount: 3,
                textScale: scale,
                onWallet: () => wallets++,
                onNotifications: () => notifications++,
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        expect(find.text('Astro Soul Path'), findsOneWidget);
        expect(find.text('₹42.75'), findsOneWidget);
        await tester.tap(find.text('₹42.75'));
        await tester.tap(find.byTooltip('Notifications, 3 unread'));
        expect(wallets, 1);
        expect(notifications, 1);
        await tester.tap(find.byTooltip('Menu'));
        await tester.pumpAndSettle();
        expect(find.text('Existing drawer'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets('golden vector header rendering', (tester) async {
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
      for (final entry in {
        'PreviewRoboto': 'Roboto-Regular.ttf',
        'serif': 'Roboto-Regular.ttf',
        'MaterialIcons': 'materialicons-regular.otf',
      }.entries) {
        final bytes = File(
          '$sdk/bin/cache/artifacts/material_fonts/${entry.value}',
        ).readAsBytesSync();
        await (FontLoader(
          entry.key,
        )..addFont(Future.value(ByteData.sublistView(bytes)))).load();
      }
    });
    tester.view.physicalSize = const Size(390, 850);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        theme: ThemeData(fontFamily: 'PreviewRoboto'),
        home: Scaffold(
          body: RepaintBoundary(
            key: const ValueKey('header-golden'),
            child: ColoredBox(
              color: const Color(0xFFFFF9F1),
              child: SizedBox(
                height: 174,
                child: CurvedCosmicHomeHeader(
                  walletLabel: 'Test balance',
                  unreadCount: 0,
                  onWallet: () {},
                  onNotifications: () {},
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byKey(const ValueKey('header-golden')),
      matchesGoldenFile('goldens/compact_cosmic_header.png'),
    );
  });
}
