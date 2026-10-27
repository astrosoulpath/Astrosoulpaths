import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/support/data/support_api.dart';
import 'package:astro_soul_path/features/support/data/support_models.dart';
import 'package:astro_soul_path/features/support/data/support_catalogue.dart';
import 'package:astro_soul_path/features/support/presentation/screens/assistant_support_chat_screen.dart';

class FakeAssistantApi extends SupportApi {
  FakeAssistantApi() : super(accessToken: 'synthetic');
  bool available = true, fail = false;
  Object? healthError;
  Completer<void>? pending;
  final keys = <String?>[];
  final queries = <String>[];
  final metadata = <Map<String, String?>>[];
  final messages = <SupportMessageModel>[];
  @override
  Future<SupportCatalogue> getAssistantConfig({bool refresh = false}) async =>
      const SupportCatalogue(
        welcome: 'Namaste! 🙏 How can I help you today?',
        categories: [
          SupportCategory(
            id: 'payment',
            title: 'Payment & Refund Help',
            questions: [],
          ),
          SupportCategory(
            id: 'consultation',
            title: 'Consultation Help',
            questions: [],
          ),
          SupportCategory(
            id: 'account',
            title: 'App & Account Help',
            questions: [
              SupportQuestion(id: 'account-1', text: 'Kundli AI Help'),
            ],
          ),
        ],
      );
  @override
  Future<bool> isAssistantAvailable() async {
    if (healthError != null) throw healthError!;
    return available;
  }

  AssistantConversationModel get conversation => AssistantConversationModel(
    id: 'synthetic',
    status: 'ACTIVE',
    messages: List.of(messages),
  );
  @override
  Future<AssistantConversationModel> startOrGetAssistantConversation() async =>
      conversation;
  @override
  Future<AssistantConversationModel> getAssistantConversation(
    String id,
  ) async => conversation;
  @override
  Future<AssistantSendResult> sendAssistantMessage({
    required String conversationId,
    required String content,
    String? clientMessageId,
    String? categoryId,
    String? questionId,
    String? paymentOrderId,
    String? consultationId,
  }) async {
    keys.add(clientMessageId);
    metadata.add({
      'categoryId': categoryId,
      'questionId': questionId,
      'paymentOrderId': paymentOrderId,
      'consultationId': consultationId,
    });
    queries.add(content);
    await pending?.future;
    if (fail) throw const SupportApiException('Temporarily unavailable');
    final customer = SupportMessageModel.fromJson({
      'id': 'one',
      'content': content,
      'senderType': 'CUSTOMER',
    });
    final reply = SupportMessageModel.fromJson({
      'id': 'two',
      'content': 'Synthetic provider reply',
      'senderType': 'ASSISTANT',
    });
    messages.addAll([customer, reply]);
    return AssistantSendResult(
      customerMessage: customer,
      assistantReply: reply,
      providerStatus: 'CONNECTED',
    );
  }
}

void main() {
  testWidgets(
    'Admin denial offers recovery without sending or bypassing retry',
    (tester) async {
      final api = FakeAssistantApi()
        ..healthError = const SupportApiException(
          'Admin identity is not authorized',
          statusCode: 403,
        );
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(home: AssistantSupportChatScreen(api: api)),
      );
      await tester.pumpAndSettle();
      expect(find.text('Customer sign-in required'), findsOneWidget);
      expect(find.text('Use a customer account'), findsOneWidget);
      expect(find.byType(TextField), findsNothing);
      expect(api.queries, isEmpty);
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(find.text('Customer sign-in required'), findsOneWidget);
      expect(api.queries, isEmpty);
    },
  );

  testWidgets('ownership denial does not offer account-switch recovery', (
    tester,
  ) async {
    final api = FakeAssistantApi()
      ..healthError = const SupportApiException(
        'Private detail',
        statusCode: 403,
      );
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Access denied'), findsOneWidget);
    expect(find.text('Use a customer account'), findsNothing);
    expect(find.text('Private detail'), findsNothing);
    expect(api.queries, isEmpty);
  });

  testWidgets('quick topic prepares editable text and never auto-sends', (
    tester,
  ) async {
    final api = FakeAssistantApi();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('App & Account Help'));
    await tester.tap(find.text('App & Account Help'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Kundli AI Help'));
    await tester.tap(find.text('Kundli AI Help'));
    await tester.pump();
    expect(
      tester.widget<TextField>(find.byType(TextField)).controller!.text,
      'Kundli AI Help',
    );
    expect(api.queries, isEmpty);
    await tester.tap(find.byTooltip('Send question'));
    await tester.pumpAndSettle();
    expect(api.queries, ['Kundli AI Help']);
  });
  testWidgets(
    'empty text sends nothing and Hindi/Hinglish text remains intact',
    (tester) async {
      final api = FakeAssistantApi();
      addTearDown(api.close);
      await tester.pumpWidget(
        MaterialApp(home: AssistantSupportChatScreen(api: api)),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Send question'));
      await tester.pump();
      expect(api.queries, isEmpty);
      const query = 'नमस्ते, Kundli help chahiye';
      await tester.enterText(find.byType(TextField), query);
      await tester.tap(find.byTooltip('Send question'));
      await tester.pumpAndSettle();
      expect(api.queries, [query]);
    },
  );
  testWidgets('late response preserves a newer draft', (tester) async {
    final api = FakeAssistantApi()..pending = Completer<void>();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'First synthetic question');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pump();
    expect(find.textContaining('thinking'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'Next unsent draft');
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(find.text('Next unsent draft'), findsOneWidget);
    expect(api.queries, ['First synthetic question']);
  });
  testWidgets('pending send completion after disposal is safe', (tester) async {
    final api = FakeAssistantApi()..pending = Completer<void>();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Synthetic question');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    api.pending!.complete();
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  testWidgets('welcome remains scrollable on a small screen with keyboard', (
    tester,
  ) async {
    final api = FakeAssistantApi();
    addTearDown(api.close);
    tester.view.physicalSize = const Size(320, 568);
    tester.view.devicePixelRatio = 1;
    tester.view.viewInsets = const FakeViewPadding(bottom: 240);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetViewInsets);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byType(SingleChildScrollView), findsWidgets);
  });
  testWidgets('welcome, topics, free text and existing service response', (
    tester,
  ) async {
    final api = FakeAssistantApi();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Astro Soul Path AI Support'), findsOneWidget);
    expect(
      find.textContaining('Welcome to Astro Soul Path Support'),
      findsOneWidget,
    );
    await tester.enterText(find.byType(TextField), 'Synthetic question');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pumpAndSettle();
    expect(api.queries, ['Synthetic question']);
    expect(find.text('Synthetic provider reply'), findsOneWidget);
  });
  testWidgets('failed send preserves draft and stable retry identity', (
    tester,
  ) async {
    final api = FakeAssistantApi()..fail = true;
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Retry draft');
    await tester.tap(find.byTooltip('Send question'));
    await tester.pumpAndSettle();
    expect(find.text('Retry draft'), findsOneWidget);
    // Let the error snackbar dismiss before interacting with the composer.
    await tester.pump(const Duration(seconds: 5));
    await tester.pumpAndSettle();
    api.fail = false;
    await tester.tap(find.byTooltip('Send question'));
    await tester.pumpAndSettle();
    expect(api.keys.length, 2);
    expect(api.keys[0], api.keys[1]);
  });
  testWidgets('unavailable provider offers retry and original human flow', (
    tester,
  ) async {
    final api = FakeAssistantApi()..available = false;
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('Help & Support'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    api.available = true;
    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(find.byType(TextField), findsOneWidget);
  });
}
