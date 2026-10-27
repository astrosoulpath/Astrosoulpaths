import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/customer/data/free_chat_entitlement_api.dart';
import 'package:astro_soul_path/features/customer/data/free_chat_promotion_session.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/free_chat_avatars.dart';

class _Session extends AuthSessionStore {
  String? owner = 'customer';
  String role = 'CUSTOMER';
  @override
  Future<StoredAuthSession?> read() async => owner == null
      ? null
      : StoredAuthSession(
          accessToken: 'synthetic',
          refreshToken: '',
          role: role,
          portal: role == 'CUSTOMER' ? 'customer' : 'astrologer',
          nextStep: '',
          user: {
            'id': owner,
            'freeChat': {'eligible': true},
          },
          expiresIn: 3600,
        );
}

String response({
  bool used = false,
  bool popup = true,
  String owner = 'customer',
}) => jsonEncode({
  'success': true,
  'role': 'CUSTOMER',
  'portal': 'customer',
  'user': {
    'id': owner,
    'freeChat': {
      'eligible': !used,
      'used': used,
      'minutes': 1,
      'showPopup': popup,
    },
  },
});
List<PublicAstrologer> pool(int count) => List.generate(
  count,
  (i) => PublicAstrologer.fromJson({
    'id': 'astro-$i',
    'name': 'Synthetic $i',
    'isVerified': true,
    'isOnline': true,
  }),
);

void main() {
  test(
    'fresh server response overrides stale login entitlement across devices',
    () async {
      var used = false;
      final api = FreeChatEntitlementApi(
        sessions: _Session(),
        client: MockClient((request) async {
          expect(request.url.path, '/user/session');
          expect(request.url.queryParameters['portal'], 'customer');
          return http.Response(response(used: used), 200);
        }),
      );
      expect((await api.fetch())!.eligible, true);
      used = true;
      expect((await api.fetch())!.eligible, false);
      used =
          false; // Rejection/cancellation restored by the server, not a local grant.
      expect((await api.fetch())!.eligible, true);
      api.close();
    },
  );
  test('account switching fences in-flight entitlement response', () async {
    final session = _Session();
    final pendingResponse = Completer<http.Response>();
    final api = FreeChatEntitlementApi(
      sessions: session,
      client: MockClient((_) => pendingResponse.future),
    );
    final pending = api.fetch();
    await Future<void>.delayed(Duration.zero);
    session.owner = 'different-customer';
    pendingResponse.complete(http.Response(response(), 200));
    expect(await pending, isNull);
    api.close();
  });
  test(
    'logout and astrologer roles cannot obtain a customer promotion',
    () async {
      var calls = 0;
      final session = _Session()..owner = null;
      final api = FreeChatEntitlementApi(
        sessions: session,
        client: MockClient((_) async {
          calls++;
          return http.Response(response(), 200);
        }),
      );
      expect(await api.fetch(), isNull);
      session.owner = 'astrologer';
      session.role = 'ASTROLOGER';
      expect(await api.fetch(), isNull);
      expect(calls, 0);
      api.close();
    },
  );
  test('server account mismatch is rejected', () async {
    final api = FreeChatEntitlementApi(
      sessions: _Session(),
      client: MockClient(
        (_) async => http.Response(response(owner: 'foreign'), 200),
      ),
    );
    expect(await api.fetch(), isNull);
    api.close();
  });
  test(
    'expired authentication fails closed without retrying or granting entitlement',
    () async {
      var calls = 0;
      final api = FreeChatEntitlementApi(
        sessions: _Session(),
        client: MockClient((_) async {
          calls++;
          return http.Response('{}', 401);
        }),
      );
      await expectLater(api.fetch(), throwsStateError);
      expect(calls, 1);
      api.close();
    },
  );
  test(
    'active consultation suppresses automatic popup while preserving eligibility',
    () async {
      final api = FreeChatEntitlementApi(
        sessions: _Session(),
        client: MockClient(
          (_) async => http.Response(response(popup: false), 200),
        ),
      );
      final fresh = (await api.fetch())!;
      expect(fresh.eligible, true);
      expect(fresh.canPresent, false);
      api.close();
    },
  );
  test(
    'parallel opens and Home remounts share one popup and one stable selection',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final plans = await Future.wait([
        FreeChatPromotionSessions().open('rotation-parallel', 11),
        FreeChatPromotionSessions().open('rotation-parallel', 11),
      ]);
      expect(identical(plans[0], plans[1]), true);
      expect(plans[0].claimPresentation(), true);
      expect(plans[1].claimPresentation(), false);
      expect(
        plans[0].select(pool(8)).map((a) => a.id),
        plans[1].select(pool(8).reversed.toList()).map((a) => a.id),
      );
    },
  );
  test(
    'new login rotates fairly without repeating selection when enough astrologers exist',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final sessions = FreeChatPromotionSessions();
      final first = await sessions.open('rotation-fair', 21);
      final second = await sessions.open('rotation-fair', 22);
      expect(
        first
            .select(pool(10))
            .map((a) => a.id)
            .toSet()
            .intersection(second.select(pool(10)).map((a) => a.id).toSet()),
        isEmpty,
      );
      expect(second.presented, false);
    },
  );
  test(
    'offline selected astrologers disappear without silently replacing identities',
    () {
      final session = FreeChatPromotionSession(0);
      final original = pool(8);
      final selected = session.select(original);
      final remaining = original
          .where((a) => a.id != selected.first.id)
          .toList();
      expect(session.select(remaining).length, 4);
      expect(
        session
            .select(remaining)
            .every((a) => selected.any((s) => s.id == a.id)),
        true,
      );
    },
  );
  test(
    'empty pool does not permanently prevent later legitimate discovery',
    () {
      final session = FreeChatPromotionSession(0);
      expect(session.select(const []), isEmpty);
      expect(session.select(pool(2)).length, 2);
    },
  );
  testWidgets(
    'dismissal survives widget recreation within the authenticated session',
    (tester) async {
      final session = FreeChatPromotionSession(0);
      Widget home() => MaterialApp(
        home: Scaffold(
          body: FreeChatAvatars(
            records: pool(2),
            promotionSession: session,
            presentModal: true,
            onSelect: (_) async {},
          ),
        ),
      );
      await tester.pumpWidget(home());
      await tester.pumpAndSettle();
      await tester.tap(find.text('Maybe Later'));
      await tester.pumpAndSettle();
      await tester.pumpWidget(const SizedBox());
      await tester.pumpAndSettle();
      await tester.pumpWidget(home());
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsNothing);
    },
  );
  testWidgets('eligibility invalidation removes only its own popup', (
    tester,
  ) async {
    final visible = ValueNotifier(true);
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ValueListenableBuilder<bool>(
            valueListenable: visible,
            builder: (_, show, _) => show
                ? FreeChatAvatars(
                    records: pool(1),
                    presentModal: true,
                    onSelect: (_) async {},
                  )
                : const Text('Promotion hidden'),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byType(Dialog), findsOneWidget);
    visible.value = false;
    await tester.pumpAndSettle();
    expect(find.byType(Dialog), findsNothing);
    expect(find.text('Promotion hidden'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    visible.dispose();
  });
}
