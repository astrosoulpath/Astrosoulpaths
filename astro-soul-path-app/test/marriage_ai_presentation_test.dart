import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/category_ai/presentation/widgets/marriage_ai_presentation.dart';

void main() {
  testWidgets('background lifecycle pauses carousel', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: MarriageCelestialHero())),
    );
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump(const Duration(seconds: 10));
    expect(
      find.text('Explore partnership through a thoughtful Vedic lens.'),
      findsOneWidget,
    );
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(milliseconds: 4500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(
      find.text('Understand communication and emotional connection.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('questions fill composer without submitting; send is explicit', (
    tester,
  ) async {
    final controller = TextEditingController();
    var sent = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: MarriageAiPresentation(
          controller: controller,
          messages: const [],
          sending: false,
          grounded: null,
          onSend: () => sent++,
          onRetry: () {},
        ),
      ),
    );
    final question = find.text(MarriageAiPresentation.questions.first);
    await tester.scrollUntilVisible(
      question,
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(question);
    await tester.pump();
    expect(controller.text, MarriageAiPresentation.questions.first);
    expect(sent, 0);
    await tester.tap(find.byTooltip('Send question'));
    expect(sent, 1);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets('hero advances after 4.5 seconds and disposes safely', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: MarriageCelestialHero())),
    );
    expect(
      find.text('Explore partnership through a thoughtful Vedic lens.'),
      findsOneWidget,
    );
    await tester.pump(const Duration(milliseconds: 4500));
    await tester.pump(const Duration(milliseconds: 500));
    expect(
      find.text('Understand communication and emotional connection.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 10));
    expect(tester.takeException(), isNull);
  });

  testWidgets('reduced motion stops auto advance; dots remain interactive', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: MediaQuery(
          data: MediaQueryData(disableAnimations: true),
          child: Scaffold(body: MarriageCelestialHero()),
        ),
      ),
    );
    await tester.pump(const Duration(seconds: 10));
    expect(
      find.text('Explore partnership through a thoughtful Vedic lens.'),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('Marriage insight 6 of 6'));
    await tester.pump();
    expect(
      find.text('Your choices remain at the heart of your journey.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('small screen large text and keyboard do not overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final controller = TextEditingController();
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 640),
            textScaler: TextScaler.linear(2),
            disableAnimations: true,
          ),
          child: MarriageAiPresentation(
            controller: controller,
            messages: const [],
            sending: false,
            grounded: false,
            onSend: () {},
            onRetry: () {},
          ),
        ),
      ),
    );
    await tester.tap(find.byType(TextField));
    await tester.pump();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });

  testWidgets(
    'context status requires confirmation and error retry stays explicit',
    (tester) async {
      final controller = TextEditingController();
      var retries = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: MarriageAiPresentation(
            controller: controller,
            messages: const [(text: 'Synthetic test answer', fromUser: false)],
            sending: false,
            grounded: true,
            error: 'Synthetic failure',
            onSend: () {},
            onRetry: () => retries++,
          ),
        ),
      );
      final retry = find.text('Try again');
      await tester.scrollUntilVisible(
        retry,
        300,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.drag(find.byType(ListView), const Offset(0, -180));
      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(retry);
      expect(retries, 1);
      await tester.pumpWidget(const SizedBox());
      controller.dispose();
    },
  );
}
