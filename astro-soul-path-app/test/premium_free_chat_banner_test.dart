import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';
import 'package:astro_soul_path/features/customer/data/free_chat_entitlement_api.dart';
import 'package:astro_soul_path/features/customer/data/free_chat_promotion_session.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/premium_free_chat_banner.dart';
import 'package:astro_soul_path/core/widgets/golden_sparkle_loading.dart';

FreeChatEntitlement grant({
  bool eligible = true,
  bool used = false,
  bool present = true,
  String owner = 'synthetic',
  int? revision,
}) => FreeChatEntitlement(
  userId: owner,
  revision: revision ?? AuthSessionStore.sessionRevision,
  eligible: eligible,
  used: used,
  minutes: 1,
  canPresent: present,
);

class Probe extends FreeChatEntitlementApi {
  int calls = 0;
  Future<FreeChatEntitlement?> Function() next = () async => grant();
  @override
  Future<FreeChatEntitlement?> fetch() {
    calls++;
    return next();
  }
}

Widget home(
  FreeChatPromotionSession session,
  Probe api, {
  FreeChatEntitlement? e,
  bool absent = false,
  Future<void> Function(FreeChatEntitlement)? navigate,
  double scale = 1,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(
      disableAnimations: true,
      textScaler: TextScaler.linear(scale),
    ),
    child: Scaffold(
      body: SingleChildScrollView(
        child: PremiumFreeChatBanner(
          entitlement: absent ? null : e ?? grant(),
          session: session,
          api: api,
          onContinue: navigate ?? (_) async {},
        ),
      ),
    ),
  ),
);

void main() {
  test('six original variants use distinct portrait assets and palettes', () {
    expect(FreeChatBannerDesign.values.length, 6);
    expect(FreeChatBannerDesign.values.map((e) => e.asset).toSet().length, 6);
    expect(
      FreeChatBannerDesign.values.map((e) => e.background).toSet().length,
      6,
    );
  });
  for (var i = 0; i < 6; i++) {
    testWidgets(
      'variant $i fits 320dp and exposes honest offer, portrait and close',
      (tester) async {
        tester.view.physicalSize = const Size(320, 900);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final api = Probe();
        addTearDown(api.close);
        await tester.pumpWidget(
          home(FreeChatPromotionSession(i), api, scale: i == 5 ? 2 : 1),
        );
        await tester.pumpAndSettle();
        expect(find.text('Your First 1 Min Chat is FREE'), findsOneWidget);
        expect(find.text('Illustrative model'), findsOneWidget);
        expect(find.byTooltip('Close Free Chat offer'), findsOneWidget);
        expect(find.byType(PremiumFreeChatBanner), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'dismissal hides immediately without navigation, replacement or remount repeat',
    (tester) async {
      final api = Probe();
      addTearDown(api.close);
      final session = FreeChatPromotionSession(0);
      var routes = 0;
      Widget page() => home(
        session,
        api,
        navigate: (_) async {
          routes++;
        },
      );
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('Close Free Chat offer'));
      await tester.pump();
      expect(find.text('Chat Now →'), findsNothing);
      expect(api.calls, 0);
      expect(routes, 0);
      await tester.pumpWidget(const SizedBox());
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      expect(find.text('Chat Now →'), findsNothing);
    },
  );
  for (final status in ['false', 'used', 'unknown', 'pending']) {
    testWidgets('$status eligibility fails closed', (tester) async {
      final api = Probe();
      addTearDown(api.close);
      await tester.pumpWidget(
        home(
          FreeChatPromotionSession(0),
          api,
          absent: status == 'unknown',
          e: grant(
            eligible: status != 'false',
            used: status == 'used',
            present: status != 'pending',
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Chat Now →'), findsNothing);
      expect(api.calls, 0);
    });
  }
  testWidgets(
    'revalidation and duplicate taps navigate exactly once through callback',
    (tester) async {
      final api = Probe();
      addTearDown(api.close);
      final pending = Completer<FreeChatEntitlement?>();
      api.next = () => pending.future;
      var routes = 0;
      await tester.pumpWidget(
        home(
          FreeChatPromotionSession(1),
          api,
          navigate: (e) async {
            expect(e.minutes, 1);
            routes++;
          },
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat Now →'));
      await tester.tap(find.text('Chat Now →'), warnIfMissed: false);
      await tester.pump();
      expect(api.calls, 1);
      expect(routes, 0);
      expect(find.byType(GoldenSparkle), findsOneWidget);
      pending.complete(grant());
      await tester.pumpAndSettle();
      expect(routes, 1);
    },
  );
  for (final failure in ['revoked', 'foreign', 'network']) {
    testWidgets('$failure revalidation never navigates', (tester) async {
      final api = Probe();
      addTearDown(api.close);
      var routes = 0;
      api.next = () async {
        if (failure == 'network') throw StateError('Synthetic outage');
        return failure == 'foreign'
            ? grant(owner: 'foreign')
            : grant(eligible: false, used: true);
      };
      await tester.pumpWidget(
        home(
          FreeChatPromotionSession(2),
          api,
          navigate: (_) async {
            routes++;
          },
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Chat Now →'));
      await tester.pumpAndSettle();
      expect(routes, 0);
      expect(find.text('Chat Now →'), findsNothing);
    });
  }
  testWidgets('dismissal during request fences late navigation', (
    tester,
  ) async {
    final api = Probe();
    addTearDown(api.close);
    final pending = Completer<FreeChatEntitlement?>();
    api.next = () => pending.future;
    var routes = 0;
    await tester.pumpWidget(
      home(
        FreeChatPromotionSession(0),
        api,
        navigate: (_) async {
          routes++;
        },
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Chat Now →'));
    await tester.pump();
    await tester.tap(find.byTooltip('Close Free Chat offer'));
    await tester.pump();
    pending.complete(grant());
    await tester.pumpAndSettle();
    expect(routes, 0);
  });
  test(
    'session dismissal survives login revision changes without persisting eligibility',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      final sessions = FreeChatPromotionSessions();
      final first = await sessions.open('banner-dismissal-test', 800);
      first.dismiss();
      final second = await sessions.open('banner-dismissal-test', 801);
      expect(second.dismissed, true);
      expect(second.claimPresentation(), false);
      expect(
        (await sessions.open('another-banner-customer', 802)).dismissed,
        false,
      );
    },
  );
}
