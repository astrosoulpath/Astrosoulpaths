import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/astrologer/data/astrologer_portal_api.dart';
import 'package:astro_soul_path/features/astrologer/presentation/screens/astrologer_customer_history_screen.dart';

class _Session extends AuthSessionStore {
  String id = 'synthetic-astrologer';
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'synthetic',
    refreshToken: '',
    role: 'ASTROLOGER',
    portal: 'astrologer',
    nextStep: 'OPEN_ASTROLOGER_DASHBOARD',
    user: {'id': id},
    expiresIn: 3600,
  );
}

class _HistoryApi extends AstrologerPortalApi {
  _HistoryApi(this.status);
  final int status;
  int calls = 0;
  @override
  Future<Map<String, dynamic>> getCustomerHistory({
    required String accessToken,
    int page = 1,
    int limit = 20,
    String search = '',
    String mode = '',
    String status = '',
  }) async {
    if (calls++ > 0) {
      throw AstrologerPortalApiException(
        'Access denied',
        statusCode: this.status,
      );
    }
    return {
      'data': [
        {
          'id': 'synthetic',
          'user': {
            'userProfile': {'fullName': 'Synthetic customer'},
          },
          'status': 'COMPLETED',
        },
      ],
      'pagination': {'totalPages': 1},
    };
  }
}

class _Pages extends AstrologerPortalApi {
  _Pages({this.empty = false, this.multiple = false, this.onRead});
  final VoidCallback? onRead;
  final bool empty;
  final bool multiple;
  String search = '';
  @override
  Future<Map<String, dynamic>> getCustomerHistory({
    required String accessToken,
    int page = 1,
    int limit = 20,
    String search = '',
    String mode = '',
    String status = '',
  }) async {
    this.search = search;
    onRead?.call();
    Map<String, dynamic> record(String id, String type) => {
      'id': id,
      'userId': 'customer',
      'mode': type,
      'status': 'COMPLETED',
      'createdAt': '2026-10-01T10:00:00Z',
      'startedAt': '2026-10-01T10:00:00Z',
      'endedAt': '2026-10-01T10:02:00Z',
      'user': {'id': 'customer', 'name': 'Synthetic customer'},
      'earning': {'netAmount': '12.50', 'currency': 'EUR', 'status': 'PENDING'},
    };
    return {
      'data': empty
          ? []
          : [
              record('one', 'chat'),
              if (page > 1) record('two', 'video'),
              if (multiple)
                {
                  ...record('other', 'audio'),
                  'userId': 'other',
                  'user': {'id': 'other', 'name': 'Second customer'},
                },
            ],
      'pagination': {'totalPages': empty ? 1 : 2},
    };
  }
}

void main() {
  testWidgets('account switch discards the previous account history response', (
    tester,
  ) async {
    final session = _Session();
    await tester.pumpWidget(
      MaterialApp(
        home: AstrologerCustomerHistoryScreen(
          api: _Pages(onRead: () => session.id = 'other'),
          sessionStore: session,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Synthetic customer'), findsNothing);
    expect(
      find.text('Account changed. Open Customer History again.'),
      findsOneWidget,
    );
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('different customers remain distinct groups', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AstrologerCustomerHistoryScreen(
          api: _Pages(multiple: true),
          sessionStore: _Session(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Synthetic customer'), findsOneWidget);
    expect(find.text('Second customer'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('empty history has truthful refreshable empty state', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: AstrologerCustomerHistoryScreen(
          api: _Pages(empty: true),
          sessionStore: _Session(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('No customers found.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
    'pages group one customer and deduplicate consultations with recorded currency',
    (tester) async {
      final api = _Pages();
      await tester.pumpWidget(
        MaterialApp(
          home: AstrologerCustomerHistoryScreen(
            api: api,
            sessionStore: _Session(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Load More'));
      await tester.pumpAndSettle();
      expect(find.text('Synthetic customer'), findsOneWidget);
      expect(find.text('2 loaded consultations'), findsOneWidget);
      await tester.tap(find.text('Synthetic customer'));
      await tester.pumpAndSettle();
      expect(find.text('EUR 12.50 · PENDING'), findsNWidgets(2));
      expect(find.text('Recorded interval: 2m 0s'), findsNWidgets(2));
      await tester.enterText(find.byType(TextField), 'Search name');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(api.search, 'Search name');
      await tester.pumpWidget(const SizedBox());
    },
  );
  for (final status in [401, 403, 500]) {
    testWidgets(
      'history denial $status removes previously loaded customer data',
      (tester) async {
        await tester.pumpWidget(
          MaterialApp(
            home: AstrologerCustomerHistoryScreen(
              api: _HistoryApi(status),
              sessionStore: _Session(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Synthetic customer'), findsOneWidget);
        final refresh = tester.widget<RefreshIndicator>(
          find.byType(RefreshIndicator),
        );
        await refresh.onRefresh();
        await tester.pumpAndSettle();
        expect(find.text('Synthetic customer'), findsNothing);
        expect(find.text('Access denied'), findsOneWidget);
        expect(find.text('Retry'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
