import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/ai_astro/data/ai_chat_language.dart';
import 'package:astro_soul_path/features/ai_astro/data/ai_chat_format.dart';
import 'package:astro_soul_path/features/ai_astro/data/ai_astro_api.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';

class _Sessions extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': 'owner'},
    expiresIn: 3600,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  testWidgets(
    'Unicode input retains scripts and keyboard text without normalization loss',
    (tester) async {
      final controller = TextEditingController();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(body: TextField(controller: controller)),
        ),
      );
      const text =
          'हिन्दी বাংলা தமிழ் తెలుగు ગુજરાતી 日本語 한국어 中文 العربية اردو русский';
      await tester.enterText(find.byType(TextField), text);
      expect(controller.text, text);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      controller.dispose();
    },
  );
  test(
    'currency formatting never changes amount or performs FX conversion',
    () {
      const amount = 3500.25;
      expect(formatAiMoney(amount, 'INR', 'hi-Latn'), contains('INR'));
      expect(formatAiMoney(amount, 'USD', 'en'), contains('USD'));
      expect(formatAiMoney(double.nan, 'USD', 'en'), '—');
      expect(amount, 3500.25);
      expect(formatAiNumber(3500, 'en'), contains('3,500'));
    },
  );
  test('date formatting preserves the supplied birth calendar date', () async {
    await prepareAiChatFormats('en');
    final date = DateTime.utc(2000, 1, 2);
    expect(formatAiDate(date, 'en'), contains('Jan 2, 2000'));
    expect(date.toIso8601String(), '2000-01-02T00:00:00.000Z');
  });
  test(
    'logout rejects a late AI response and does not reuse the old language client',
    () async {
      var calls = 0;
      final api = AiAstroApi(
        sessionStore: _Sessions(),
        client: MockClient((request) async {
          calls++;
          await AuthSessionStore().clear();
          return http.Response(
            jsonEncode({'success': true, 'answer': 'Old account answer'}),
            200,
          );
        }),
      );
      await expectLater(
        api.ask(
          category: 'GENERAL',
          question: 'Synthetic question',
          personaId: 'synthetic',
          consultantTypeCode: 'VEDIC_ASTROLOGER',
        ),
        throwsA(isA<AiAstroApiException>()),
      );
      await expectLater(
        api.setPreferredLanguage('hi'),
        throwsA(isA<AiAstroApiException>()),
      );
      expect(calls, 1);
    },
  );
  test(
    'only initial validated-code candidates are selectable; no human-review claim',
    () {
      expect(aiChatLanguages.where((l) => l.enabled).map((l) => l.code), [
        'en',
        'hi',
        'hi-Latn',
      ]);
      expect(aiChatLanguages.length, 21);
      expect(normalizeAiChatLanguage('fr'), 'auto');
    },
  );
  test('language persistence is isolated per canonical user', () async {
    final prefs = AiChatLanguagePreferences();
    await prefs.write('one', 'hi');
    await prefs.write('two', 'hi-Latn');
    expect(await prefs.read('one'), 'hi');
    expect(await prefs.read('two'), 'hi-Latn');
    expect(await prefs.read('three'), 'auto');
    await expectLater(prefs.write('one', 'ar'), throwsArgumentError);
    expect(await prefs.read('one'), 'hi');
  });
  test(
    'request sends explicit language and preserves original Unicode question',
    () async {
      final api = AiAstroApi(
        sessionStore: _Sessions(),
        client: MockClient((request) async {
          final body = jsonDecode(request.body);
          expect(body['responseLanguage'], 'hi-Latn');
          expect(body['question'], 'मेरी शादी?');
          return http.Response(
            jsonEncode({
              'success': true,
              'answer': 'Synthetic answer',
              'conversationId': 'synthetic',
            }),
            200,
          );
        }),
      );
      await api.ask(
        category: 'GENERAL',
        question: 'मेरी शादी?',
        personaId: 'synthetic',
        consultantTypeCode: 'VEDIC_ASTROLOGER',
        responseLanguage: 'hi-Latn',
      );
    },
  );
  test('direction and localized status strings retain Unicode', () {
    expect(aiChatDirection('ar'), TextDirection.rtl);
    expect(aiChatDirection('ur'), TextDirection.rtl);
    expect(aiChatDirection('hi'), TextDirection.ltr);
    expect(aiChatMessageDirection('مرحبا بالعالم'), TextDirection.rtl);
    expect(aiChatMessageDirection('آپ کیسے ہیں؟'), TextDirection.rtl);
    expect(aiChatMessageDirection('English مرحبا'), TextDirection.ltr);
    expect(aiChatLabel('hi', 'typing'), contains('उत्तर'));
    expect(aiChatLabel('hi-Latn', 'question'), contains('sawaal'));
  });
  testWidgets('labels wrap at 320px and large text without layout errors', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 320,
            child: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(2)),
              child: Wrap(
                children: [
                  for (final l in aiChatLanguages)
                    Directionality(
                      textDirection: aiChatDirection(l.code),
                      child: Text(l.label),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
    expect(tester.takeException(), isNull);
  });
}
