import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/widgets/golden_sparkle_loading.dart';

void main() {
  testWidgets(
    'transparent center preserves content and blocks duplicate actions only while busy',
    (tester) async {
      var taps = 0;
      Widget page(bool busy) => MaterialApp(
        home: Scaffold(
          body: GoldenSparkleLoading(
            loading: busy,
            child: Center(
              child: TextButton(
                onPressed: () => taps++,
                child: const Text('Existing content'),
              ),
            ),
          ),
        ),
      );
      await tester.pumpWidget(page(true));
      expect(find.text('Existing content'), findsOneWidget);
      final barriers = find.descendant(
        of: find.byType(GoldenSparkleLoading),
        matching: find.byType(ModalBarrier),
      );
      final barrier = tester.widget<ModalBarrier>(barriers);
      expect(barrier.color, Colors.transparent);
      expect(
        tester.getCenter(find.byType(GoldenSparkle)),
        tester.getCenter(find.byType(GoldenSparkleLoading)),
      );
      expect(tester.getSize(find.byType(GoldenSparkle)), const Size(64, 64));
      await tester.tap(find.text('Existing content'), warnIfMissed: false);
      expect(taps, 0);
      await tester.pumpWidget(page(false));
      expect(barriers, findsNothing);
      await tester.tap(find.text('Existing content'));
      expect(taps, 1); // no artificial hold, even while the visual fades out
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byType(GoldenSparkle), findsNothing);
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('ready content never shows a loader or delayed barrier', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: GoldenSparkleLoading(loading: false, child: Text('Cached')),
      ),
    );
    await tester.pump(const Duration(seconds: 2));
    expect(find.byType(GoldenSparkle), findsNothing);
    expect(find.text('Cached'), findsOneWidget);
  });
  testWidgets(
    'reduced motion is static and loading transitions dispose safely',
    (tester) async {
      Widget page(bool busy) => MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: GoldenSparkleLoading(
            loading: busy,
            child: const Text('Content'),
          ),
        ),
      );
      await tester.pumpWidget(page(true));
      await tester.pumpAndSettle();
      expect(tester.binding.hasScheduledFrame, isFalse);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);
      await tester.pumpWidget(page(false));
      await tester.pump();
      expect(find.byType(GoldenSparkle), findsNothing);
      await tester.pumpWidget(page(true));
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('small screens and large text keep bounded loading artwork', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: GoldenSparkleLoading(
            loading: true,
            child: SingleChildScrollView(
              child: Text('Existing scrollable content'),
            ),
          ),
        ),
      ),
    );
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.getSize(find.byType(GoldenSparkle)), const Size(64, 64));
    await tester.pumpWidget(const SizedBox());
    expect(tester.takeException(), isNull);
  });
}
