import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/support/data/support_api.dart';
import 'package:astro_soul_path/features/support/data/support_catalogue.dart';
import 'package:astro_soul_path/features/support/presentation/screens/assistant_support_chat_screen.dart';
import 'package:astro_soul_path/features/support/presentation/widgets/home_support_shortcut.dart';
import 'support_assistant_experience_test.dart' show FakeAssistantApi;

class _FailConfig extends FakeAssistantApi {
  @override
  Future<SupportCatalogue> getAssistantConfig({bool refresh = false}) async =>
      throw const SupportApiException('Synthetic config outage');
}

void main() {
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    HomeSupportShortcut.resetWelcomeForTesting();
  });
  test(
    'catalogue filters disabled questions while preserving backend order',
    () {
      final value = SupportCatalogue.fromJson({
        'welcome': 'Namaste',
        'visible': true,
        'categories': [
          {
            'id': 'payment',
            'title': 'Payment & Refund Help',
            'enabled': true,
            'questions': [
              {'id': 'p2', 'text': 'Second first', 'enabled': true},
              {'id': 'p1', 'text': 'Disabled', 'enabled': false},
            ],
          },
          {
            'id': 'account',
            'title': 'Account',
            'enabled': false,
            'questions': [],
          },
        ],
      });
      expect(value.categories.single.id, 'payment');
      expect(value.categories.single.questions.single.id, 'p2');
    },
  );
  test(
    'malformed catalogue does not silently become enabled empty success',
    () {
      expect(
        () => SupportCatalogue.fromJson({'welcome': 'x', 'categories': []}),
        throwsFormatException,
      );
      expect(
        () => SupportCatalogue.fromJson({
          'welcome': 'x',
          'visible': true,
          'categories': [
            {'id': 'admin', 'enabled': true, 'title': 'bad', 'questions': []},
          ],
        }),
        throwsFormatException,
      );
    },
  );
  testWidgets(
    'configuration failure leaves free-text chat usable and retry visible',
    (tester) async {
      final api = _FailConfig();
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(home: AssistantSupportChatScreen(api: api)),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('Support topics could not load'),
        findsOneWidget,
      );
      expect(find.text('Reload support topics'), findsOneWidget);
      await tester.enterText(
        find.byType(TextField),
        'Synthetic manual question',
      );
      await tester.tap(find.byTooltip('Send question'));
      await tester.pumpAndSettle();
      expect(api.queries, ['Synthetic manual question']);
    },
  );
  testWidgets(
    'reference attachment is opt-in and only explicit send dispatches it',
    (tester) async {
      final api = FakeAssistantApi();
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(home: AssistantSupportChatScreen(api: api)),
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Record references'));
      await tester.tap(find.text('Record references'));
      await tester.pumpAndSettle();
      final payment = find.byWidgetPredicate(
        (w) =>
            w is TextField &&
            w.decoration?.labelText == 'Payment record ID (optional)',
      );
      await tester.enterText(payment, 'synthetic-owned-record');
      await tester.tap(find.text('Attach references'));
      await tester.pumpAndSettle();
      expect(api.queries, isEmpty);
      await tester.enterText(
        find.byType(TextField),
        'Synthetic status question',
      );
      await tester.tap(find.byTooltip('Send question'));
      await tester.pumpAndSettle();
      expect(api.metadata.single['paymentOrderId'], 'synthetic-owned-record');
      expect(api.queries.length, 1);
    },
  );
  testWidgets(
    'human escalation confirmation is single and transcript starts opted out',
    (tester) async {
      final api = FakeAssistantApi();
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(home: AssistantSupportChatScreen(api: api)),
      );
      await tester.pumpAndSettle();
      final trigger = find.byTooltip('Talk to Human Support');
      await tester.tap(trigger);
      await tester.tap(trigger, warnIfMissed: false);
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(
        tester.widget<CheckboxListTile>(find.byType(CheckboxListTile)).value,
        false,
      );
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(api.queries, isEmpty);
    },
  );
  testWidgets(
    'hint and unchanged avatar fit small screen with large reduced-motion text',
    (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(320, 640),
              textScaler: TextScaler.linear(2),
              disableAnimations: true,
            ),
            child: const Scaffold(
              bottomNavigationBar: SizedBox(height: 72),
              floatingActionButton: HomeSupportShortcut(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Need Help? Ask Me! 👋'), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(tester.getSize(find.byTooltip('AI Support')), const Size(60, 60));
      await tester.pumpWidget(const SizedBox());
    },
  );
}
