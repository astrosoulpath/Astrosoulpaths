import 'package:flutter/material.dart';
import 'dart:io';
import 'dart:convert';
import 'dart:ui' as ui;
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/feedback/data/feedback_api.dart';
import 'package:astro_soul_path/features/feedback/presentation/screens/feedback_screen.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/astrologer_detail_extras.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/cosmic_astrologer_profile.dart';
import 'package:astro_soul_path/features/customer/presentation/screens/delete_account_screen.dart';

class _Feedback extends FeedbackApi {
  final pages = <int>[];
  bool fail = true;
  @override
  Future<List<Map<String, dynamic>>> getMine({int page = 1}) async {
    pages.add(page);
    if (page == 2 && fail) {
      throw const FeedbackApiException('Synthetic failure');
    }
    return List.generate(
      page == 1 ? 25 : 1,
      (i) => {'id': '$page-$i', 'message': 'Synthetic feedback'},
    );
  }
}

void main() {
  final astrologer = PublicAstrologer.fromJson({
    'id': 'synthetic',
    'name': 'Synthetic Astrologer With A Long Display Name',
    'experience': 12,
    'pricePerMin': 27,
    'rating': 4.2,
    'expertise': ['Vedic astrology', 'Relationships'],
    'isOnline': true,
    'isVerified': false,
  });
  testWidgets('hero wraps at 320px and 2x text without a fabricated badge', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 1600),
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            body: SingleChildScrollView(
              child: CosmicAstrologerHero(
                astrologer: astrologer,
                availability: 'Offline - no consultation started',
                follow: const Text('Follow'),
              ),
            ),
          ),
        ),
      ),
    );
    expect(find.text('Verified astrologer'), findsNothing);
    expect(find.text(astrologer.name), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('recommendation uses real supplied fields and profile callback', (
    tester,
  ) async {
    var tapped = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Center(
            child: SizedBox(
              height: 270,
              child: CosmicSimilarAstrologer(
                astrologer: astrologer,
                onTap: () => tapped = true,
              ),
            ),
          ),
        ),
      ),
    );
    expect(find.text('12 years'), findsOneWidget);
    expect(find.text('₹27/min'), findsOneWidget);
    expect(find.text('Online'), findsOneWidget);
    await tester.tap(find.byType(CosmicSimilarAstrologer));
    expect(tapped, true);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'deletion readiness never claims a request or exposes destructive action',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: DeleteAccountScreen(
            loadReadiness: () async => {
              'success': true,
              'data': {'available': false, 'status': 'NOT_ENABLED'},
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('does not delete your account'),
        findsOneWidget,
      );
      await tester.drag(find.byType(ListView), const Offset(0, -700));
      await tester.pumpAndSettle();
      expect(find.text('Keep my account'), findsOneWidget);
      expect(find.text('Delete permanently'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('deletion failure offers retry without success/logout', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: DeleteAccountScreen(
          loadReadiness: () async {
            calls++;
            throw StateError('synthetic');
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.drag(find.byType(ListView), const Offset(0, -700));
    await tester.pumpAndSettle();
    expect(find.text('Retry availability check'), findsOneWidget);
    await tester.ensureVisible(find.text('Retry availability check'));
    await tester.tap(find.text('Retry availability check'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.textContaining('remains unchanged'), findsNothing);
  });
  testWidgets('failed feedback pagination retries the same page, never skips', (
    tester,
  ) async {
    final api = _Feedback();
    await tester.pumpWidget(MaterialApp(home: FeedbackScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Load more feedback'));
    await tester.pumpAndSettle();
    api.fail = false;
    await tester.tap(find.byTooltip('Load more feedback'));
    await tester.pumpAndSettle();
    expect(api.pages, [1, 2, 2]);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'recommendation failure has retry and is not fabricated empty data',
    (tester) async {
      var fail = true, calls = 0;
      final client = MockClient((_) async {
        calls++;
        return fail
            ? http.Response('unavailable', 503)
            : http.Response('{"data":[]}', 200);
      });
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: AstrologerDetailExtras(
              astrologer: astrologer,
              onAstrologerTap: (_) {},
              showReviews: false,
              client: client,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Retry recommendations'), findsOneWidget);
      expect(
        find.text('No similar astrologers available right now.'),
        findsNothing,
      );
      fail = false;
      await tester.tap(find.text('Retry recommendations'));
      await tester.pumpAndSettle();
      expect(calls, 2);
      expect(
        find.text('No similar astrologers available right now.'),
        findsOneWidget,
      );
    },
  );
  testWidgets(
    'export clearly synthetic component preview, not emulator evidence',
    (tester) async {
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
      tester.view.physicalSize = const Size(390, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final key = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(fontFamily: 'PreviewRoboto'),
          home: RepaintBoundary(
            key: key,
            child: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    const SafeArea(
                      child: Text('SYNTHETIC WIDGET PREVIEW - NOT DEVICE E2E'),
                    ),
                    CosmicAstrologerHero(
                      astrologer: astrologer,
                      availability: 'Online - synthetic preview only',
                      follow: OutlinedButton(
                        onPressed: () {},
                        child: const Text('Follow'),
                      ),
                    ),
                    const SizedBox(height: 20),
                    SizedBox(
                      height: 270,
                      child: CosmicSimilarAstrologer(
                        astrologer: astrologer,
                        onTap: () {},
                      ),
                    ),
                  ],
                ),
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
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        final file = File(
          '../review/ui/screenshots/cosmic-profile-synthetic-widget.png',
        );
        file.parent.createSync(recursive: true);
        file.writeAsBytesSync(bytes!.buffer.asUint8List());
        image.dispose();
      });
    },
  );
}
