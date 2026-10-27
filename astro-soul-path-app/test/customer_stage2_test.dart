import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/core/network/customer_session_client.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/customer_tab_back_scope.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/wallet/data/customer_wallet.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_api.dart';
import 'package:astro_soul_path/features/consultations/data/consultation_api.dart';
import 'package:astro_soul_path/features/consultations/data/consultation_models.dart';
import 'package:astro_soul_path/features/consultations/presentation/screens/consultation_history_screen.dart';

class _Session extends AuthSessionStore {
  int refreshes = 0;
  @override
  Future<StoredAuthSession?> read() async => const StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: '',
    user: {'id': 'synthetic'},
    expiresIn: 3600,
  );
  @override
  Future<StoredAuthSession?> forceRefresh() {
    refreshes++;
    return read();
  }
}

class _History extends ConsultationApi {
  bool fail = false;
  final pages = <int>[];
  final searches = <String>[];
  final statuses = <String>[];
  @override
  Future<List<ConsultationHistoryItem>> getConsultationHistory({
    int page = 1,
    int limit = 20,
    String search = '',
    String status = '',
  }) async {
    pages.add(page);
    searches.add(search);
    statuses.add(status);
    if (fail) {
      throw const ConsultationApiException('Synthetic network unavailable');
    }
    return List.generate(
      page == 1 ? 50 : 1,
      (i) => ConsultationHistoryItem.fromJson({
        'id': 'history-${page == 1 ? i : 49}',
        'status': 'CANCELLED',
        'startedAt': '2026-01-01T00:00:00Z',
        'mode': 'chat',
        'astrologer': {
          'userProfile': {'fullName': 'Synthetic astrologer'},
        },
      }),
    );
  }
}

void main() {
  test('history retains recorded currency without inventing INR', () {
    final item = ConsultationHistoryItem.fromJson({
      'id': 'synthetic',
      'earning': {'currency': 'USD'},
    });
    expect(item.currency, 'USD');
    expect(ConsultationHistoryItem.fromJson({'id': 'synthetic'}).currency, '');
  });
  testWidgets('history search and status changes restart server pagination', (
    tester,
  ) async {
    final api = _History();
    await tester.pumpWidget(
      MaterialApp(home: ConsultationHistoryScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'Synthetic');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(api.searches.last, 'Synthetic');
    expect(api.pages.last, 1);
    await tester.tap(find.text('Completed'));
    await tester.pumpAndSettle();
    expect(api.statuses.last, 'COMPLETED');
    expect(api.pages.last, 1);
    await tester.pumpWidget(const SizedBox());
  });
  for (final state in ['offline', 'busy', 'available']) {
    test('profile honors server availability for $state', () {
      final profile = PublicAstrologerProfile.fromJson({
        'id': 'synthetic',
        'isOnline': state != 'offline',
        'isBusy': state == 'busy',
        'consultationOptions': {
          'chat': true,
          'audioCall': true,
          'videoCall': true,
        },
      });
      expect(profile.canRequestChat, state != 'offline');
      expect(profile.canRequestAudio, state == 'available');
      // Historical capability remains readable; new customer video is
      // intentionally disabled by the reviewed product policy.
      expect(profile.consultationOptions.videoCall, isTrue);
      expect(profile.canRequestVideo, isFalse);
    });
  }
  testWidgets('Back on each non-home customer tab returns Home', (
    tester,
  ) async {
    for (final index in [1, 2, 3, 4]) {
      var home = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: CustomerTabBackScope(
            index: index,
            onHome: () => home++,
            child: const Scaffold(body: Text('tab')),
          ),
        ),
      );
      await tester.pump();
      await tester.binding.handlePopRoute();
      await tester.pump();
      expect(home, 1);
    }
  });
  test('late response is rejected after logout/account switch', () async {
    var revision = 0;
    final response = Completer<http.Response>();
    final client = CustomerSessionClient(
      MockClient((_) => response.future),
      revisionReader: () => revision,
    );
    final result = client.get(Uri.parse('http://synthetic.invalid/wallet'));
    final check = expectLater(result, throwsA(isA<http.ClientException>()));
    revision++;
    response.complete(http.Response('private old account', 200));
    await check;
    client.close();
  });
  test('old client cannot send under a new account', () async {
    var revision = 0, sent = 0;
    final client = CustomerSessionClient(
      MockClient((_) async {
        sent++;
        return http.Response('{}', 200);
      }),
      revisionReader: () => revision,
    );
    revision++;
    await expectLater(
      client.post(Uri.parse('http://synthetic.invalid/start')),
      throwsA(isA<http.ClientException>()),
    );
    expect(sent, 0);
    client.close();
  });
  test('transport never retries financial writes', () async {
    var sent = 0;
    final client = CustomerSessionClient(
      MockClient((_) async {
        sent++;
        return http.Response('{}', 500);
      }),
    );
    expect(
      (await client.post(
        Uri.parse('http://synthetic.invalid/start'),
      )).statusCode,
      500,
    );
    expect(sent, 1);
    client.close();
  });
  for (final status in [401, 403, 429, 500]) {
    test('wallet handles HTTP $status without unbounded retry', () async {
      final sessions = _Session();
      var sent = 0;
      final api = WalletApi(
        sessionStore: sessions,
        client: MockClient((_) async {
          sent++;
          return http.Response('{}', status);
        }),
      );
      await expectLater(api.getWallet(), throwsA(isA<WalletApiException>()));
      expect(sent, status == 401 ? 2 : 1);
      expect(sessions.refreshes, status == 401 ? 1 : 0);
      api.close();
    });
  }
  for (final currency in ['INR', 'USD', 'JPY']) {
    test('wallet labels use $currency without FX conversion', () {
      final wallet = CustomerWallet.fromJson({
        'currency': currency,
        'balance': '42.25',
        'availableBalance': '40.25',
      });
      expect(
        wallet.totalBalanceLabel,
        '${currency == 'INR' ? '\u20B9' : '$currency '}42.25',
      );
      expect(wallet.availableBalance, 40.25);
    });
  }
  test('history parses actual backend profile contract', () {
    final item = ConsultationHistoryItem.fromJson({
      'id': 'id',
      'astrologer': {
        'userProfile': {
          'fullName': 'Synthetic',
          'avatarUrl': 'https://example.invalid/a',
        },
      },
    });
    expect(item.astrologerName, 'Synthetic');
    expect(item.astrologerAvatarUrl, endsWith('/a'));
  });
  test('history API bounds pagination and rejects malformed data', () async {
    final api = ConsultationApi(
      sessionStore: _Session(),
      client: MockClient((r) async {
        expect(r.url.queryParameters, {'page': '1', 'limit': '100'});
        return http.Response(jsonEncode({'success': true, 'data': {}}), 200);
      }),
    );
    await expectLater(
      api.getConsultationHistory(page: -5, limit: 1000),
      throwsA(isA<ConsultationApiException>()),
    );
    api.close();
  });
  testWidgets('history loads subsequent page and removes duplicate IDs', (
    tester,
  ) async {
    final api = _History();
    await tester.pumpWidget(
      MaterialApp(home: ConsultationHistoryScreen(api: api)),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Load more'),
      1200,
      scrollable: find.byType(Scrollable).last,
      maxScrolls: 60,
    );
    await tester.tap(find.text('Load more'));
    await tester.pumpAndSettle();
    expect(api.pages, [1, 2]);
    expect(find.text('Load more'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'history expands owned consultation details without starting a session',
    (tester) async {
      final api = _History();
      await tester.pumpWidget(
        MaterialApp(home: ConsultationHistoryScreen(api: api)),
      );
      await tester.pumpAndSettle();
      final details = find.text('View details').first;
      await tester.ensureVisible(details);
      await tester.tap(details);
      await tester.pumpAndSettle();
      expect(find.text('Reference: history-0'), findsOneWidget);
      expect(find.textContaining('\u00c3'), findsNothing);
      expect(find.textContaining('1/1/2026 | '), findsWidgets);
      expect(find.text('Status: CANCELLED'), findsOneWidget);
      expect(api.pages, [1]);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
  testWidgets('history error offers working retry', (tester) async {
    final api = _History()..fail = true;
    await tester.pumpWidget(
      MaterialApp(home: ConsultationHistoryScreen(api: api)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Try Again'), findsOneWidget);
    api.fail = false;
    await tester.tap(find.text('Try Again'));
    await tester.pumpAndSettle();
    expect(find.text('Try Again'), findsNothing);
    await tester.pumpWidget(const SizedBox());
  });
}
