import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/branding/celestial_feature_tile.dart';
import 'package:astro_soul_path/core/branding/premium_customer_surfaces.dart';
import 'package:astro_soul_path/features/about_us/presentation/screens/about_us_screen.dart';
import 'package:astro_soul_path/features/app_config/data/app_config_model.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/premium_astrologer_services.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/astrologer_detail_extras.dart';
import 'package:astro_soul_path/features/reviews/data/review_api.dart';
import 'package:astro_soul_path/features/reviews/data/astrologer_review.dart';

class _Reviews extends ReviewApi {
  bool fail = false;
  int calls = 0;
  @override
  Future<AstrologerReviewSummary> getAstrologerReviews(
    String astrologerId,
  ) async {
    calls++;
    if (fail) throw const ReviewApiException('synthetic failure');
    return AstrologerReviewSummary(
      astrologerId: astrologerId,
      averageRating: 0,
      totalReviews: 0,
      reviews: const [],
    );
  }
}

const _config = AppConfigModel(
  shareMessage: '',
  androidStoreUrl: '',
  iosStoreUrl: '',
  websiteUrl: '',
  aboutTitle: 'Backend title',
  aboutDescription: 'Only backend-provided content.',
);

void main() {
  testWidgets(
    'Services preserves backend rate and is readable at 320px with 2x text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final profile = PublicAstrologerProfile.fromJson({
        'id': 'synthetic',
        'isOnline': false,
        'pricePerMin': 125,
        'availability': 'Currently offline',
        'consultationOptions': {
          'chat': true,
          'audioCall': true,
          'videoCall': true,
        },
      });
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 1400),
              textScaler: TextScaler.linear(2),
            ),
            child: Scaffold(
              body: SingleChildScrollView(
                child: PremiumAstrologerServices(profile: profile),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text(profile.astrologer.priceLabel), findsOneWidget);
      expect(find.text('Video Call'), findsNothing);
      expect(find.text('Unavailable'), findsNWidgets(2));
      expect(tester.takeException(), isNull);
    },
  );
  for (final width in [320.0, 390.0, 768.0]) {
    for (final brightness in Brightness.values) {
      testWidgets('readable Explore titles $width $brightness at large text', (
        tester,
      ) async {
        tester.view.physicalSize = Size(width, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            theme: ThemeData(brightness: brightness),
            home: MediaQuery(
              data: MediaQueryData(
                size: Size(width, 1000),
                textScaler: const TextScaler.linear(2),
                disableAnimations: true,
              ),
              child: Scaffold(
                body: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final f in CelestialFeature.values)
                      Expanded(
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
                  ],
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();
        for (final label in [
          'Kundli AI',
          'Horoscope',
          'AI Astro',
          'Predictions',
        ]) {
          final text = tester.widget<Text>(find.text(label));
          expect(text.style!.color, premiumInk);
          expect(text.maxLines, isNull);
          expect(tester.getRect(find.text(label)).bottom, lessThan(1000));
        }
        expect(tester.takeException(), isNull);
        expect(
          tester
              .widgetList<Image>(find.byType(Image))
              .map((i) => i.image)
              .toSet()
              .length,
          4,
        );
        await tester.pumpWidget(const SizedBox());
      });
    }
  }
  testWidgets('category labels and callbacks remain distinct', (tester) async {
    final taps = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final entry in {
                  'career': 'Career',
                  'marriage': 'Marriage',
                  'stock_market': 'Stock Market',
                  'today': 'Today',
                  'business': 'Business',
                }.entries)
                  PremiumCategoryTile(
                    assetPath:
                        'assets/stickers/home_astrology/${entry.key}-premium.webp',
                    label: entry.value,
                    onTap: () => taps.add(entry.value),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Career'));
    expect(taps, ['Career']);
    expect(find.text('Stock Market'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  testWidgets('section header action is visible at 320px and 2x text', (
    tester,
  ) async {
    var taps = 0;
    tester.view.physicalSize = const Size(320, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 1000),
            textScaler: TextScaler.linear(2),
          ),
          child: Scaffold(
            body: PremiumSectionBanner(
              title: 'Real Astrologers',
              subtitle: 'Explore existing profiles',
              assetPath:
                  'assets/stickers/home_astrology/real-section-premium.webp',
              icon: Icons.support_agent,
              onTap: () => taps++,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('View all'));
    expect(taps, 1);
    expect(tester.takeException(), isNull);
  });
  testWidgets('About retains backend text and recovers from failure', (
    tester,
  ) async {
    var calls = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: AboutUsScreen(
          loadConfig: () async {
            if (calls++ == 0) throw Exception('synthetic');
            return _config;
          },
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('Backend title'), findsOneWidget);
    expect(find.text(_config.aboutDescription), findsOneWidget);
  });
  testWidgets('About empty state has no invented platform content', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AboutUsScreen(
          loadConfig: () async => AppConfigModel.fromJson({}),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('About Us content is not available yet.'), findsOneWidget);
  });
  testWidgets('review failure is distinct from zero reviews and can retry', (
    tester,
  ) async {
    final api = _Reviews()..fail = true;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AstrologerDetailExtras(
            astrologer: PublicAstrologer.fromJson({'id': 'synthetic'}),
            reviewApi: api,
            showSimilar: false,
            onAstrologerTap: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Reviews could not be loaded.'), findsOneWidget);
    expect(find.text('No customer reviews yet.'), findsNothing);
    api.fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('No customer reviews yet.'), findsOneWidget);
    expect(api.calls, 2);
  });
  testWidgets('hidden reviews do not make network requests', (tester) async {
    final api = _Reviews();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: AstrologerDetailExtras(
            astrologer: PublicAstrologer.fromJson({'id': 'synthetic'}),
            reviewApi: api,
            showReviews: false,
            showSimilar: false,
            onAstrologerTap: (_) {},
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(api.calls, 0);
    expect(find.text('Ratings & Reviews'), findsNothing);
  });
}
