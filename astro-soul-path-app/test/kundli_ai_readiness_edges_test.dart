import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/category_ai/data/category_ai_api.dart';
import 'package:astro_soul_path/features/category_ai/presentation/screens/category_ai_chat_screen.dart';
import 'package:astro_soul_path/features/category_ai/presentation/widgets/kundli_assistant_design.dart';
import 'package:astro_soul_path/features/category_ai/presentation/widgets/premium_kundli_ai_presentation.dart';

class _ContextApi extends CategoryAiApi {
  _ContextApi(this.reply);
  final CategoryAiResponse reply;
  @override
  Future<CategoryAiResponse> ask({
    required String category,
    required String question,
    String language = 'en',
  }) async => reply;
}

const _session = StoredAuthSession(
  accessToken: 'synthetic',
  refreshToken: '',
  role: 'CUSTOMER',
  portal: 'customer',
  nextStep: '',
  user: {'id': 'synthetic'},
  expiresIn: 900,
);

class _Session extends AuthSessionStore {
  int refreshes = 0;
  @override
  Future<StoredAuthSession?> read() async => _session;
  @override
  Future<StoredAuthSession?> forceRefresh() async {
    refreshes++;
    return _session;
  }
}

void main() {
  testWidgets('keyboard at 320dp keeps composer and questions accessible', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final c = TextEditingController();
    var requests = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(
            size: Size(320, 700),
            viewInsets: EdgeInsets.only(bottom: 280),
            disableAnimations: true,
            textScaler: TextScaler.linear(1.5),
          ),
          child: PremiumKundliAiPresentation(
            design: marketAssistant,
            controller: c,
            messages: const [],
            sending: false,
            grounded: null,
            onSend: () => requests++,
            onRetry: () {},
          ),
        ),
      ),
    );
    final f = find.text(marketAssistant.questions.first);
    await tester.scrollUntilVisible(
      f,
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await Scrollable.ensureVisible(tester.element(f), alignment: .4);
    await tester.pump();
    await tester.tap(f);
    await tester.pump();
    expect(c.text, marketAssistant.questions.first);
    expect(requests, 0);
    expect(
      tester.getBottomRight(find.byType(TextField)).dy,
      lessThanOrEqualTo(420),
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  for (final invalid in [
    const CategoryAiResponse(
      category: 'career',
      answer: 'Synthetic',
      grounded: true,
      source: 'LOCAL_VEDIC_KUNDLI',
    ),
    const CategoryAiResponse(
      category: 'career',
      answer: 'Synthetic',
      grounded: true,
      source: 'unknown',
      kundliId: 'test',
    ),
    const CategoryAiResponse(
      category: 'marriage',
      answer: 'Synthetic',
      grounded: true,
      source: 'LOCAL_VEDIC_KUNDLI',
      kundliId: 'test',
    ),
  ]) {
    testWidgets(
      'unverified chart is not connected: ${invalid.category}/${invalid.source}/${invalid.kundliId}',
      (tester) async {
        final api = _ContextApi(invalid);
        await tester.pumpWidget(
          MaterialApp(
            home: CategoryAiChatScreen(
              category: AspAiCategory.career,
              api: api,
            ),
          ),
        );
        await tester.enterText(find.byType(TextField), 'Synthetic');
        await tester.pump();
        await tester.tap(find.byTooltip('Send question'));
        await tester.pump();
        final presentation = tester.widget<PremiumKundliAiPresentation>(
          find.byType(PremiumKundliAiPresentation),
        );
        expect(presentation.grounded, false);
        expect(presentation.onBirthDetails, isNotNull);
        await tester.pumpWidget(const SizedBox());
        api.dispose();
      },
    );
  }
  testWidgets('neutral context birth-details action and busy protection', (
    tester,
  ) async {
    final c = TextEditingController();
    var opened = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: PremiumKundliAiPresentation(
          controller: c,
          messages: const [],
          sending: true,
          grounded: null,
          onBirthDetails: () => opened++,
          onSend: () {},
          onRetry: () {},
        ),
      ),
    );
    final f = find.text('Review my birth details');
    await tester.scrollUntilVisible(
      f,
      120,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.tap(f);
    expect(opened, 1);
    expect(tester.widget<TextField>(find.byType(TextField)).enabled, false);
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (w) => w is IconButton && w.tooltip == 'Send question',
            ),
          )
          .onPressed,
      isNull,
    );
    await tester.pumpWidget(const SizedBox());
    c.dispose();
  });
  for (final succeeds in [true, false]) {
    test('expired category session refreshes once; success=$succeeds', () async {
      final session = _Session();
      var calls = 0;
      final api = CategoryAiApi(
        sessionStore: session,
        client: MockClient((r) async {
          calls++;
          return http.Response(
            calls == 1 || !succeeds
                ? '{}'
                : '{"category":"career","answer":"Synthetic","grounded":true,"source":"LOCAL_VEDIC_KUNDLI","kundliId":"test"}',
            calls == 1 || !succeeds ? 401 : 200,
          );
        }),
      );
      if (succeeds) {
        expect(
          (await api.ask(category: 'career', question: 'Synthetic')).answer,
          'Synthetic',
        );
      } else {
        await expectLater(
          api.ask(category: 'career', question: 'Synthetic'),
          throwsA(isA<CategoryAiApiException>()),
        );
      }
      expect(calls, 2);
      expect(session.refreshes, 1);
      api.dispose();
    });
  }
}
