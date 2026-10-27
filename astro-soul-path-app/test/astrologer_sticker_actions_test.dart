import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/astrologer_default_avatar.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/astrologer_sticker_actions.dart';
import 'package:astro_soul_path/features/customer/presentation/screens/customer_home_screen.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/ai_astro/data/ai_astro_models.dart';

void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'AI cards preserve persona data and horizontal scrolling at scale $scale',
      (tester) async {
        final persona = AiAstroPersona.fromJson({
          'id': 'ai-exact',
          'name': 'A long AI persona name',
          'subtitle': 'Vedic guidance',
          'rating': 4.6,
          'available': false,
        });
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: Scaffold(
                body: SizedBox(
                  width: 320,
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var i = 0; i < 4; i++)
                          SizedBox(
                            width: 124 + (scale - 1) * 84,
                            child: HomeAiAstrologerStickerCard(
                              persona: persona,
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
        await tester.pump();
        expect(find.text('Call'), findsNothing);
        expect(find.text(persona.aiPricing.displayLabel), findsWidgets);
        expect(find.text(persona.name), findsWidgets);
        final cardSurfaces = tester.widgetList<Container>(
          find.descendant(
            of: find.byType(HomeAiAstrologerStickerCard).first,
            matching: find.byType(Container),
          ),
        );
        expect(
          cardSurfaces.any(
            (surface) =>
                surface.decoration is BoxDecoration &&
                (surface.decoration! as BoxDecoration).gradient != null &&
                (surface.decoration! as BoxDecoration).border != null,
          ),
          isTrue,
        );
        expect(find.text('AI ASTROLOGER'), findsWidgets);
        expect(find.byIcon(Icons.auto_awesome_rounded), findsWidgets);
        expect(
          tester
              .widgetList<Image>(find.byType(Image))
              .any(
                (image) =>
                    image.image is AssetImage &&
                    (image.image as AssetImage).assetName ==
                        'assets/stickers/support_astrologer.webp',
              ),
          isFalse,
        );
        expect(tester.takeException(), isNull);
        final height = tester
            .getSize(find.byType(HomeAiAstrologerStickerCard).first)
            .height;
        debugPrint('AI fixture height at $scale: $height');
        if (scale == 1) expect(height, lessThan(244));
        await tester.drag(
          find.byType(SingleChildScrollView),
          const Offset(-150, 0),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'actual human card retains data and missing-photo fallback at scale $scale',
      (tester) async {
        final astrologer = PublicAstrologer.fromJson({
          'id': 'exact-id',
          'name': 'A very long astrologer name for layout testing',
          'pricePerMin': 1234,
          'rating': 4.8,
          'isOnline': true,
          'isVerified': true,
          'experience': 12,
          'expertise': ['Vedic Astrology'],
        });
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: Scaffold(
                body: SizedBox(
                  width: 150,
                  child: HomeAstrologerStickerCard(
                    astrologer: astrologer,
                    onChat: () {},
                    onCall: () {},
                  ),
                ),
              ),
            ),
          ),
        );
        expect(find.text(astrologer.priceLabel), findsOneWidget);
        expect(find.text(astrologer.ratingLabel), findsOneWidget);
        expect(find.byType(AstrologerDefaultAvatar), findsOneWidget);
        expect(find.text('Verified'), findsOneWidget);
        final height = tester
            .getSize(find.byType(HomeAstrologerStickerCard))
            .height;
        debugPrint('Human fixture height at $scale: $height');
        expect(height, lessThan(272 + (scale - 1) * 196));
        final infoBottom = tester
            .getBottomLeft(find.text(astrologer.experienceLabel))
            .dy;
        final priceTop = tester.getTopLeft(find.text(astrologer.priceLabel)).dy;
        expect(priceTop - infoBottom, lessThan(70));
        expect(
          tester.getSize(find.byType(FilledButton)).height,
          greaterThanOrEqualTo(48),
        );
        expect(
          tester.getSize(find.byType(OutlinedButton)).height,
          greaterThanOrEqualTo(48),
        );
        expect(tester.takeException(), isNull);
      },
    );
  }
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'nested actions use exact identity without parent navigation at scale $scale',
      (tester) async {
        final destinations = <String>[];
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(textScaler: TextScaler.linear(scale)),
              child: Scaffold(
                body: Center(
                  child: SizedBox(
                    width: 128,
                    child: GestureDetector(
                      onTap: () => destinations.add('profile:canonical-astro'),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Profile body'),
                          AstrologerStickerActions(
                            onChat: () =>
                                destinations.add('chat:canonical-astro'),
                            onCall: () =>
                                destinations.add('call:canonical-astro'),
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
        await tester.tap(find.text('Chat'));
        expect(destinations, ['chat:canonical-astro']);
        await tester.tap(find.text('Call'));
        expect(destinations, ['chat:canonical-astro', 'call:canonical-astro']);
        await tester.tap(find.text('Profile body'));
        expect(destinations.last, 'profile:canonical-astro');
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('offline or busy actions remain disabled', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 150,
            child: AstrologerStickerActions(onChat: null, onCall: null),
          ),
        ),
      ),
    );
    expect(
      tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
      isNull,
    );
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
  });
}
