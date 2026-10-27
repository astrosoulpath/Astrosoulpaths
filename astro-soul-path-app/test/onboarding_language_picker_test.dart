import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/onboarding_language_picker.dart';
import 'package:astro_soul_path/features/language/data/language_api.dart';

AppLanguage language(String code, String name, {bool active = true}) =>
    AppLanguage(
      code: code,
      englishName: name,
      nativeName: name,
      imageUrl: null,
      isActive: active,
      sortOrder: 0,
    );

void main() {
  testWidgets('active server choices select by touch and survive rebuild', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    var selected = 'en';
    Set<String> available = {};
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: StatefulBuilder(
            builder: (context, update) => OnboardingLanguagePicker(
              value: selected,
              onChanged: (value) => update(() => selected = value),
              onAvailableCodes: (value) => available = value,
              loadLanguages: () async => [
                language('en', 'English'),
                language('hi', 'Hindi'),
                language('es', 'Spanish'),
                language('ta', 'Tamil', active: false),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(available, {'en', 'hi', 'es'});
    expect(find.text('Tamil'), findsNothing);
    await tester.tap(find.byKey(const ValueKey('onboarding-language-hi')));
    await tester.pumpAndSettle();
    expect(selected, 'hi');
    expect(
      tester
          .widget<ChoiceChip>(
            find.byKey(const ValueKey('onboarding-language-hi')),
          )
          .selected,
      isTrue,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'failed catalogue can retry; empty catalogue invents no languages',
    (tester) async {
      var attempts = 0;
      Set<String> available = {'en'};
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: OnboardingLanguagePicker(
              value: 'en',
              onChanged: (_) {},
              onAvailableCodes: (value) => available = value,
              loadLanguages: () async {
                if (++attempts == 1) throw Exception('offline');
                return [];
              },
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(available, isEmpty);
      await tester.tap(find.text('Retry languages'));
      await tester.pumpAndSettle();
      expect(
        find.text('No supported language is available. Please retry later.'),
        findsOneWidget,
      );
      expect(find.byType(ChoiceChip), findsNothing);
    },
  );

  testWidgets('disabled saving state prevents language mutation', (
    tester,
  ) async {
    var changes = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OnboardingLanguagePicker(
            value: 'en',
            enabled: false,
            onChanged: (_) => changes++,
            onAvailableCodes: (_) {},
            loadLanguages: () async => [
              language('en', 'English'),
              language('hi', 'Hindi'),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Hindi'));
    expect(changes, 0);
    expect(tester.takeException(), isNull);
  });
}
