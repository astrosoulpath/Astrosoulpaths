import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/support/presentation/widgets/home_support_shortcut.dart';

void main() {
  setUp(HomeSupportShortcut.resetWelcomeForTesting);
  testWidgets('welcome appears once, exits and leaves avatar usable', (
    tester,
  ) async {
    const home = MaterialApp(
      home: Scaffold(floatingActionButton: HomeSupportShortcut()),
    );
    await tester.pumpWidget(home);
    expect(find.text('Need Help? Ask Me! 👋'), findsNothing);
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text('Need Help? Ask Me! 👋'), findsOneWidget);
    for (var frame = 0; frame < 80; frame++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
    expect(find.text('Need Help? Ask Me! 👋'), findsNothing);
    expect(
      tester.getSize(find.byType(HomeSupportShortcut)),
      const Size(60, 60),
    );
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(home);
    await tester.pump(const Duration(seconds: 5));
    expect(find.text('Need Help? Ask Me! 👋'), findsNothing);
    await tester.tap(find.byTooltip('AI Support'));
    await tester.pump(const Duration(seconds: 1));
    expect(find.byType(SupportWelcomeScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('disposing during welcome delay cancels timers', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: HomeSupportShortcut()));
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 5));
    expect(tester.takeException(), isNull);
  });
  for (final size in [const Size(412, 915), const Size(320, 568)]) {
    testWidgets('floating panel margins and launcher at $size', (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: child!,
          ),
          home: const Scaffold(
            bottomNavigationBar: SizedBox(height: 72),
            floatingActionButton: HomeSupportShortcut(),
          ),
        ),
      );
      final launcher = find.byType(HomeSupportShortcut);
      expect(
        tester.getSize(launcher).width,
        lessThanOrEqualTo(size.width - 32),
      );
      expect(tester.getSize(find.byTooltip('AI Support')), const Size(60, 60));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Need Help? Ask Me! 👋'), findsOneWidget);
      expect(
        find.descendant(of: launcher, matching: find.byType(Container)),
        findsNothing,
      );
      expect(
        find.descendant(
          of: launcher,
          matching: find.byIcon(Icons.chat_bubble_rounded),
        ),
        findsNothing,
      );
      final glow = tester.widget<DecoratedBox>(
        find.descendant(of: launcher, matching: find.byType(DecoratedBox)),
      );
      final decoration = glow.decoration as BoxDecoration;
      expect(decoration.shape, BoxShape.circle);
      expect(decoration.color, isNull);
      expect(decoration.gradient, isNull);
      expect(
        tester
            .widget<GestureDetector>(
              find
                  .descendant(
                    of: launcher,
                    matching: find.byType(GestureDetector),
                  )
                  .first,
            )
            .behavior,
        HitTestBehavior.opaque,
      );
      expect(tester.getBottomRight(launcher).dy, lessThan(size.height - 72));
      await tester.tap(find.byTooltip('AI Support'));
      await tester.pumpAndSettle();
      final panel = find.byType(SupportWelcomeScreen);
      expect(tester.getTopLeft(panel).dx, greaterThanOrEqualTo(16));
      expect(
        tester.getBottomRight(panel).dx,
        lessThanOrEqualTo(size.width - 16),
      );
      expect(find.byType(SupportAstrologerPortrait), findsWidgets);
      expect(tester.takeException(), isNull);
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Chat with AI Assistant'));
      expect(tester.takeException(), isNull);
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.byTooltip('Close AI Support'));
      await tester.tap(find.byTooltip('Close AI Support'));
      await tester.pumpAndSettle();
      expect(find.byType(SupportWelcomeScreen), findsNothing);
    });
  }
  testWidgets('one launcher, rapid taps open one welcome, back restores Home', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: child!,
        ),
        home: const Scaffold(floatingActionButton: HomeSupportShortcut()),
      ),
    );
    expect(find.byType(HomeSupportShortcut), findsOneWidget);
    final button = find.byTooltip('AI Support');
    await tester.tap(button);
    await tester.tap(button, warnIfMissed: false);
    await tester.pumpAndSettle();
    expect(find.byType(SupportWelcomeScreen), findsOneWidget);
    expect(find.text('Chat with AI Assistant'), findsOneWidget);
    expect(find.text('Contact Support Team'), findsNothing);
    expect(
      tester.getSize(find.byType(SupportWelcomeScreen)).height,
      lessThan(tester.view.physicalSize.height * .6),
    );
    await tester.tap(find.byTooltip('Close AI Support'));
    await tester.pumpAndSettle();
    expect(find.byType(SupportWelcomeScreen), findsNothing);
    expect(button, findsOneWidget);
  });

  testWidgets('small screen with large text scrolls without overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 568),
            textScaler: TextScaler.linear(1.6),
          ),
          child: const SupportWelcomeScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.ensureVisible(find.text('Chat with AI Assistant'));
    expect(tester.takeException(), isNull);
  });
}
