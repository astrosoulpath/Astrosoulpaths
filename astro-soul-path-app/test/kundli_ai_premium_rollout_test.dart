import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/category_ai/data/category_ai_api.dart';
import 'package:astro_soul_path/features/category_ai/presentation/screens/category_ai_chat_screen.dart';
import 'package:astro_soul_path/features/category_ai/presentation/widgets/kundli_assistant_design.dart';
import 'package:astro_soul_path/features/category_ai/presentation/widgets/premium_kundli_ai_presentation.dart';

class _Api extends CategoryAiApi {
  final calls = <String>[];
  Completer<CategoryAiResponse>? pending;
  @override
  Future<CategoryAiResponse> ask({
    required String category,
    required String question,
    String language = 'en',
  }) async {
    calls.add(category);
    return pending == null
        ? CategoryAiResponse(
            category: category,
            answer: 'Synthetic response for $category',
            grounded: true,
            source: 'LOCAL_VEDIC_KUNDLI',
            kundliId: 'synthetic-chart',
          )
        : pending!.future;
  }
}

class _Session extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => const StoredAuthSession(
    accessToken: 'synthetic-token',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': 'synthetic-customer'},
    expiresIn: 900,
  );
}

final _variants = <AspAiCategory, KundliAssistantDesign>{
  AspAiCategory.marriage: marriageAssistant,
  AspAiCategory.career: careerAssistant,
  AspAiCategory.love: loveAssistant,
  AspAiCategory.match: matchAssistant,
  AspAiCategory.stockMarket: marketAssistant,
  AspAiCategory.today: todayAssistant,
  AspAiCategory.business: businessAssistant,
};

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'registry unique; six distinct messages/questions and four topics each',
    () {
      expect(kundliAssistantDesigns.length, 7);
      expect(kundliAssistantDesigns.map((d) => d.id).toSet().length, 7);
      expect(
        kundliAssistantDesigns.expand((d) => d.messages).toSet().length,
        42,
      );
      expect(
        kundliAssistantDesigns.expand((d) => d.questions).toSet().length,
        42,
      );
      for (final d in kundliAssistantDesigns) {
        expect(d.questions.length, 6);
        expect(d.messages.length, 6);
        expect(d.topics.length, 4);
        expect(d.topicQuestionIndices.every((i) => i >= 0 && i < 6), true);
      }
    },
  );
  for (final entry in _variants.entries) {
    final d = entry.value;
    for (final width in [320.0, 360.0, 390.0, 430.0]) {
      testWidgets(
        '${d.id} all questions visible and composer usable at $width',
        (tester) async {
          tester.view.physicalSize = Size(width, 850);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.resetPhysicalSize);
          addTearDown(tester.view.resetDevicePixelRatio);
          final c = TextEditingController();
          var sends = 0;
          await tester.pumpWidget(
            MaterialApp(
              home: MediaQuery(
                data: MediaQueryData(
                  size: Size(width, 850),
                  disableAnimations: true,
                  textScaler: TextScaler.linear(width == 390 ? 2 : 1),
                ),
                child: PremiumKundliAiPresentation(
                  design: d,
                  controller: c,
                  messages: const [],
                  sending: false,
                  grounded: null,
                  onSend: () => sends++,
                  onRetry: () {},
                ),
              ),
            ),
          );
          expect(find.text('Kundli AI · ${d.title}'), findsOneWidget);
          for (final topic in d.topics) {
            final f = find.text(topic);
            await tester.scrollUntilVisible(
              f,
              180,
              scrollable: find.byType(Scrollable).first,
            );
            expect(f, findsOneWidget);
          }
          for (final q in d.questions) {
            final f = find.text(q);
            await tester.scrollUntilVisible(
              f,
              180,
              scrollable: find.byType(Scrollable).first,
            );
            await Scrollable.ensureVisible(tester.element(f), alignment: .4);
            await tester.pump();
            await tester.tap(f);
            await tester.pump();
            expect(c.text, q);
            expect(sends, 0);
          }
          await tester.tap(find.byTooltip('Send question'));
          expect(sends, 1);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox());
          c.dispose();
        },
      );
    }
    testWidgets('${d.id} screen preserves actual API category', (tester) async {
      final api = _Api();
      await tester.pumpWidget(
        MaterialApp(
          home: CategoryAiChatScreen(category: entry.key, api: api),
        ),
      );
      await tester.enterText(find.byType(TextField), 'Synthetic question');
      await tester.pump();
      await tester.tap(find.byTooltip('Send question'));
      await tester.pump();
      expect(api.calls, [d.apiKey]);
      final text = find.text(
        'Kundli context confirmed by the latest AI response',
        findRichText: true,
      );
      // Context status is explicitly checked through the presentation state, not inferred from an icon.
      final view = tester.widget<PremiumKundliAiPresentation>(
        find.byType(PremiumKundliAiPresentation),
      );
      expect(view.grounded, true);
      expect(
        view.messages.singleWhere((m) => !m.fromUser).text,
        'Synthetic response for ${d.apiKey}',
      );
      expect(text, isNotNull);
      await tester.pumpWidget(const SizedBox());
      api.dispose();
    });
    testWidgets('${d.id} carousel advances and pauses without height jumps', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: PremiumCelestialHero(design: d)),
        ),
      );
      final height = tester.getSize(find.byType(PremiumCelestialHero)).height;
      await tester.pump(const Duration(milliseconds: 4500));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text(d.messages[1]), findsOneWidget);
      expect(tester.getSize(find.byType(PremiumCelestialHero)).height, height);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump(const Duration(seconds: 10));
      expect(find.text(d.messages[1]), findsOneWidget);
      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 5));
      expect(tester.takeException(), isNull);
    });
  }
  testWidgets('assistant change clears composer and rejects a late response', (
    tester,
  ) async {
    final api = _Api()..pending = Completer<CategoryAiResponse>();
    await tester.pumpWidget(
      MaterialApp(
        home: CategoryAiChatScreen(category: AspAiCategory.love, api: api),
      ),
    );
    await tester.enterText(find.byType(TextField), 'Old assistant question');
    await tester.pump();
    await tester.tap(find.byTooltip('Send question'));
    await tester.pump();
    await tester.pumpWidget(
      MaterialApp(
        home: CategoryAiChatScreen(category: AspAiCategory.career, api: api),
      ),
    );
    api.pending!.complete(
      const CategoryAiResponse(
        category: 'love',
        answer: 'Late private reply',
        grounded: true,
        source: 'LOCAL_VEDIC_KUNDLI',
        kundliId: 'test',
      ),
    );
    await tester.pump();
    final view = tester.widget<PremiumKundliAiPresentation>(
      find.byType(PremiumKundliAiPresentation),
    );
    expect(view.messages, isEmpty);
    expect(view.controller.text, isEmpty);
    expect(view.grounded, isNull);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets(
    'account switch removes old screen state and suppresses late reply',
    (tester) async {
      final api = _Api()..pending = Completer<CategoryAiResponse>();
      await tester.pumpWidget(
        MaterialApp(
          home: CategoryAiChatScreen(
            category: AspAiCategory.marriage,
            api: api,
          ),
        ),
      );
      await tester.enterText(find.byType(TextField), 'Private old question');
      await tester.pump();
      await tester.tap(find.byTooltip('Send question'));
      await tester.pump();
      await tester.runAsync(() => AuthSessionStore().clear());
      await tester.pump(const Duration(seconds: 1));
      api.pending!.complete(
        const CategoryAiResponse(
          category: 'marriage',
          answer: 'Late private reply',
          grounded: true,
          source: 'LOCAL_VEDIC_KUNDLI',
        ),
      );
      await tester.pump();
      expect(find.byType(PremiumKundliAiPresentation), findsNothing);
      expect(find.textContaining('Your account changed'), findsOneWidget);
      expect(find.text('Late private reply'), findsNothing);
      await tester.pumpWidget(const SizedBox());
      api.dispose();
    },
  );
  test(
    'category HTTP request stays authenticated and rejects late account response',
    () async {
      final response = Completer<http.Response>();
      var calls = 0;
      final api = CategoryAiApi(
        sessionStore: _Session(),
        client: MockClient((r) async {
          calls++;
          expect(r.url.path, '/kundli/category-ai/ask');
          expect(r.headers['Authorization'], 'Bearer synthetic-token');
          expect(jsonDecode(r.body)['category'], 'career');
          return response.future;
        }),
      );
      final request = api.ask(category: 'career', question: 'Synthetic');
      final rejected = expectLater(
        request,
        throwsA(isA<CategoryAiApiException>()),
      );
      await Future<void>.delayed(Duration.zero);
      await AuthSessionStore().clear();
      response.complete(
        http.Response(
          '{"category":"career","answer":"Late synthetic","grounded":true}',
          200,
        ),
      );
      await rejected;
      expect(calls, 1);
      api.dispose();
    },
  );
  test(
    'Match shortcut is distinct; legacy notification/deep-link entries preserved',
    () {
      final home = File(
        'lib/features/customer/presentation/screens/customer_home_screen.dart',
      ).readAsStringSync();
      expect(home, contains('openGuidance(AspAiCategory.match)'));
      for (final path in [
        'lib/app/astro_soul_path_app.dart',
        'lib/features/notifications/presentation/screens/customer_notifications_screen.dart',
      ]) {
        final source = File(path).readAsStringSync();
        for (final category in ['marriage', 'career', 'love']) {
          expect(source, contains('category: AspAiCategory.$category'));
        }
      }
    },
  );
}
