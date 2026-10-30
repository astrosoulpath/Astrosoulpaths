import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/theme/app_theme.dart';
import 'package:astro_soul_path/features/feedback/data/feedback_api.dart';
import 'package:astro_soul_path/features/feedback/presentation/screens/feedback_screen.dart';

class FixtureFeedback extends FeedbackApi {
  bool fail = false;
  int reads = 0, submits = 0;
  Completer<Map<String, dynamic>>? pending;
  @override
  Future<List<Map<String, dynamic>>> getMine({int page = 1}) async {
    reads++;
    if (fail) throw const FeedbackApiException('Synthetic history failure');
    return [];
  }

  @override
  Future<Map<String, dynamic>> submit({
    required String category,
    int? rating,
    required String message,
    String? consultationId,
  }) {
    submits++;
    return (pending = Completer<Map<String, dynamic>>()).future;
  }

  @override
  void close() {}
}

void main() {
  for (final dark in [false, true]) {
    testWidgets(
      'feedback $dark at 320dp, retry and duplicate-submit protection',
      (tester) async {
        tester.view.physicalSize = const Size(320, 850);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = FixtureFeedback()..fail = true;
        await tester.pumpWidget(
          MaterialApp(
            theme: dark ? AppTheme.dark : AppTheme.light,
            home: FeedbackScreen(api: api),
          ),
        );
        await tester.pumpAndSettle();
        final scrollable = find
            .descendant(
              of: find.byType(ListView),
              matching: find.byType(Scrollable),
            )
            .first;
        await tester.scrollUntilVisible(
          find.text('Try again'),
          400,
          scrollable: scrollable,
        );
        expect(find.text('No feedback submitted yet.'), findsNothing);
        api.fail = false;
        await tester.tap(find.text('Try again'));
        await tester.pumpAndSettle();
        expect(api.reads, 2);
        expect(find.text('No feedback submitted yet.'), findsOneWidget);
        await tester.scrollUntilVisible(
          find.byType(TextFormField),
          -350,
          scrollable: scrollable,
        );
        await tester.enterText(
          find.byType(TextFormField),
          'Synthetic isolated widget feedback only',
        );
        await tester.scrollUntilVisible(
          find.text('Submit Feedback'),
          300,
          scrollable: scrollable,
        );
        await tester.tap(find.text('Submit Feedback'));
        await tester.tap(find.text('Submit Feedback'));
        expect(api.submits, 1);
        api.pending!.complete({'success': true});
        await tester.pumpAndSettle();
        expect(
          find.text('Thank you. Your feedback has been submitted.'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
}
