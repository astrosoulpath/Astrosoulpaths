import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/auth/data/customer_onboarding_flow.dart';
import 'package:astro_soul_path/features/profile/data/customer_profile.dart';
import 'package:astro_soul_path/features/astrologers/data/astrologer_api.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/astrologers/presentation/screens/astrologer_detail_screen.dart';
import 'package:astro_soul_path/features/support/data/support_api.dart';
import 'package:astro_soul_path/features/support/data/support_models.dart';
import 'package:astro_soul_path/features/support/presentation/screens/support_home_screen.dart';
import 'package:astro_soul_path/features/support/presentation/screens/assistant_support_chat_screen.dart';
import 'package:astro_soul_path/features/support/presentation/screens/support_ticket_detail_screen.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_seller_api.dart';
import 'package:astro_soul_path/features/marketplace/presentation/screens/marketplace_product_form_screen.dart';
import 'package:astro_soul_path/features/marketplace/data/marketplace_customer_api.dart';
import 'package:astro_soul_path/features/marketplace/presentation/screens/marketplace_cart_screen.dart';

class Sessions extends AuthSessionStore {
  final pending = Completer<StoredAuthSession?>();
  @override
  Future<StoredAuthSession?> read() => pending.future;
  @override
  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async => const StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': 'synthetic'},
    expiresIn: 3600,
  );
}

class RestoreRace extends AuthSessionStore {
  final pending = Completer<StoredAuthSession?>();
  @override
  Future<StoredAuthSession?> restore({String? portal, bool persist = true}) =>
      pending.future;
}

class ReplyAfterDispose extends SupportApi {
  ReplyAfterDispose() : super(accessToken: 'synthetic');
  final reply = Completer<SupportMessageModel>();
  int loads = 0;
  @override
  Future<SupportTicketDetail> getTicket(String id) async {
    loads++;
    return SupportTicketDetail.fromJson({
      'id': id,
      'subject': 'Synthetic',
      'status': 'OPEN',
      'messages': [],
    });
  }

  @override
  Future<void> markTicketRead(String id) async {}
  @override
  Future<SupportMessageModel> sendTicketMessage({
    required String ticketId,
    required String content,
    String? clientMessageId,
  }) => reply.future;
}

class BrokenProfile extends AstrologerApi {
  @override
  Future<PublicAstrologerProfile> getPublicAstrologerById(String id) async =>
      throw StateError('private internal detail');
}

class Categories extends MarketplaceSellerApi {
  int loads = 0;
  @override
  Future<List<Map<String, dynamic>>> getCategories() async {
    loads++;
    if (loads == 1) throw StateError('private internal detail');
    return [
      {'id': 'synthetic', 'name': 'Synthetic category'},
    ];
  }
}

class BrokenCart extends MarketplaceCustomerApi {
  @override
  Future<Map<String, dynamic>> getCart() async =>
      throw StateError('private internal detail');
}

class TicketPages extends SupportApi {
  TicketPages(this.pages) : super(accessToken: 'synthetic');
  final List<int> pages;
  @override
  Future<bool> isAssistantAvailable() async => false;
  @override
  Future<List<SupportTicketSummary>> getMyTickets({
    int page = 1,
    String search = '',
    String? status,
  }) async {
    pages.add(page);
    if (page == 2 && pages.where((p) => p == 2).length == 1) {
      throw const SupportApiException('Temporarily unavailable');
    }
    return List.generate(
      page == 1 ? 25 : 1,
      (i) => SupportTicketSummary.fromJson({
        'id': '$page-$i',
        'subject': 'Synthetic ticket $i',
      }),
    );
  }
}

class DelayedTicket extends SupportApi {
  DelayedTicket() : super(accessToken: 'synthetic');
  final pending = Completer<SupportTicketDetail>();
  int receipts = 0;
  @override
  Future<SupportTicketDetail> getTicket(String id) => pending.future;
  @override
  Future<void> markTicketRead(String id) async {
    receipts++;
  }
}

class DelayedHealth extends SupportApi {
  DelayedHealth() : super(accessToken: 'synthetic');
  final pending = Completer<bool>();
  int starts = 0;
  @override
  Future<bool> isAssistantAvailable() => pending.future;
  @override
  Future<AssistantConversationModel> startOrGetAssistantConversation() async {
    starts++;
    return const AssistantConversationModel(
      id: 'synthetic',
      status: 'ACTIVE',
      messages: [],
    );
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'account switch while profiles load cannot open previous profile',
    () async {
      final sessions = Sessions();
      final profiles = Completer<List<CustomerProfile>>();
      var forms = 0;
      final result = completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () => profiles.future,
        showForm: (_) async {
          forms++;
          return true;
        },
      );
      await Future<void>.delayed(Duration.zero);
      await sessions.clear();
      profiles.complete([]);
      expect(await result, false);
      expect(forms, 0);
    },
  );
  test(
    'logout during initial restore cannot bypass onboarding with complete profile',
    () async {
      final sessions = RestoreRace();
      final result = completeCustomerOnboarding(
        sessions: sessions,
        loadProfiles: () async => throw StateError('must not load'),
        showForm: (_) async => throw StateError('must not show'),
      );
      await sessions.clear();
      sessions.pending.complete(
        const StoredAuthSession(
          accessToken: 'synthetic',
          refreshToken: '',
          role: 'CUSTOMER',
          portal: 'customer',
          nextStep: '',
          user: {'id': 'synthetic', 'isProfileComplete': true},
          expiresIn: 3600,
        ),
      );
      expect(await result, false);
    },
  );
  test('wrong portal cannot open Customer dashboard', () async {
    final sessions = RestoreRace();
    final result = completeCustomerOnboarding(
      sessions: sessions,
      loadProfiles: () async => throw StateError('must not load'),
      showForm: (_) async => true,
    );
    sessions.pending.complete(
      const StoredAuthSession(
        accessToken: 'synthetic',
        refreshToken: '',
        role: 'ADMIN',
        portal: 'admin',
        nextStep: '',
        user: {'id': 'synthetic', 'isProfileComplete': true},
        expiresIn: 3600,
      ),
    );
    expect(await result, false);
  });
  testWidgets('reply completion after disposal cannot reload private ticket', (
    tester,
  ) async {
    final api = ReplyAfterDispose();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        home: SupportTicketDetailScreen(api: api, ticketId: 'synthetic'),
      ),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).last, 'Synthetic reply');
    await tester.tap(find.byIcon(Icons.send_rounded));
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    api.reply.complete(
      SupportMessageModel(
        id: 'synthetic',
        content: 'Synthetic reply',
        senderType: 'CUSTOMER',
        createdAt: DateTime(2026),
      ),
    );
    await tester.pump();
    expect(api.loads, 1);
    expect(tester.takeException(), isNull);
  });
  testWidgets('AI health response after disposal cannot start conversation', (
    tester,
  ) async {
    final api = DelayedHealth();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(home: AssistantSupportChatScreen(api: api)),
    );
    await tester.pumpWidget(const SizedBox());
    api.pending.complete(true);
    await tester.pump();
    expect(api.starts, 0);
    expect(tester.takeException(), isNull);
  });
  testWidgets('support disposal while session loads creates no client', (
    tester,
  ) async {
    final sessions = Sessions();
    var clients = 0;
    await tester.pumpWidget(
      MaterialApp(
        home: SupportHomeScreen(
          sessions: sessions,
          apiFactory: (token) {
            clients++;
            return SupportApi(accessToken: token);
          },
        ),
      ),
    );
    await tester.pumpWidget(const SizedBox());
    sessions.pending.complete(await sessions.restore());
    await tester.pump();
    expect(clients, 0);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'unexpected profile failure exits spinner with retry and sanitized message',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerDetailScreen(
            astrologerId: 'synthetic',
            api: BrokenProfile(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        find.text('Unable to load this profile. Please retry.'),
        findsOneWidget,
      );
      expect(find.textContaining('private internal detail'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('unexpected category failure offers working safe retry', (
    tester,
  ) async {
    final api = Categories();
    await tester.pumpWidget(
      MaterialApp(home: MarketplaceProductFormScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(api.loads, 1);
    final retry = find.text('Retry categories');
    await tester.scrollUntilVisible(
      retry,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    expect(
      find.text('Unable to load categories. Please retry.'),
      findsOneWidget,
    );
    await tester.tap(retry);
    await tester.pumpAndSettle();
    expect(api.loads, 2);
    expect(find.text('Unable to load categories. Please retry.'), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets('disposed ticket does not send a late read receipt', (
    tester,
  ) async {
    final api = DelayedTicket();
    addTearDown(api.close);
    await tester.pumpWidget(
      MaterialApp(
        home: SupportTicketDetailScreen(api: api, ticketId: 'synthetic'),
      ),
    );
    await tester.pumpWidget(const SizedBox());
    api.pending.complete(SupportTicketDetail.fromJson({'id': 'synthetic'}));
    await tester.pump();
    expect(api.receipts, 0);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'failed ticket page cannot be skipped and retry repeats the failed page',
    (tester) async {
      final sessions = Sessions();
      sessions.pending.complete(await sessions.restore());
      final pages = <int>[];
      await tester.pumpWidget(
        MaterialApp(
          home: SupportHomeScreen(
            sessions: sessions,
            apiFactory: (_) => TicketPages(pages),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Load more tickets'));
      await tester.pumpAndSettle();
      expect(pages, [1, 2]);
      final more = tester.widget<IconButton>(
        find.byWidgetPredicate(
          (widget) =>
              widget is IconButton && widget.tooltip == 'Load more tickets',
        ),
      );
      expect(more.onPressed, isNull);
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(pages, [1, 2, 2]);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('unexpected cart failure exits spinner and offers retry', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(home: MarketplaceCartScreen(api: BrokenCart())),
    );
    await tester.pumpAndSettle();
    expect(find.text('Unable to load cart. Please retry.'), findsOneWidget);
    expect(find.text('Retry'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.textContaining('private internal detail'), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
