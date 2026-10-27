import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/astrologer_default_avatar.dart';
import 'package:astro_soul_path/features/customer/presentation/widgets/free_chat_avatars.dart';

PublicAstrologer record(
  String id, {
  bool online = true,
  bool busy = false,
  bool approved = true,
}) => PublicAstrologer.fromJson({
  'id': id,
  'name': 'Synthetic $id',
  'isOnline': online,
  'isBusy': busy,
  // PublicAstrologer consumes the verified public-catalogue contract.
  'isVerified': approved,
});

void main() {
  testWidgets(
    'modal closes immediately and rebuild does not present it again',
    (tester) async {
      var presented = 0;
      Widget home() => MaterialApp(
        home: Scaffold(
          body: FreeChatAvatars(
            records: [record('real-id')],
            presentModal: true,
            onPresented: () => presented++,
            onSelect: (_) async {},
          ),
        ),
      );
      await tester.pumpWidget(home());
      await tester.pumpAndSettle();
      expect(find.text('Maybe Later'), findsOneWidget);
      await tester.tap(find.byTooltip('Close Free Chat offer'));
      await tester.pumpAndSettle();
      expect(find.byType(Dialog), findsNothing);
      await tester.pumpWidget(home());
      await tester.pumpAndSettle();
      expect(presented, 1);
      expect(find.byType(Dialog), findsNothing);
      expect(find.text('Your First Chat Is On Us'), findsOneWidget);
    },
  );
  test('five deterministic designs, independent of display name', () {
    expect(
      {
        for (var i = 0; i < 5; i++) AstrologerDefaultAvatar.designFor('id-$i'),
      }.length,
      5,
    );
    expect(
      AstrologerDefaultAvatar.designFor('canonical'),
      AstrologerDefaultAvatar.designFor('canonical'),
    );
  });
  test(
    'deduplicates IDs and excludes unavailable/unverified/empty records',
    () {
      final selected = selectFreeChatAstrologers([
        record('a'),
        record('a'),
        record('b', online: false),
        record('c', busy: true),
        record('d', approved: false),
        record(''),
        record('e'),
      ], 0);
      expect(selected.map((a) => a.id), ['a', 'e']);
    },
  );
  test('caps at five and rotates without mutating source', () {
    final records = List.generate(8, (i) => record('id-$i'));
    expect(selectFreeChatAstrologers(records, 0).length, 5);
    expect(selectFreeChatAstrologers(records, 1).map((a) => a.id), [
      'id-1',
      'id-2',
      'id-3',
      'id-4',
      'id-5',
    ]);
    expect(records.first.id, 'id-0');
    expect(
      selectFreeChatAstrologers(records, 0).map((a) => a.id),
      selectFreeChatAstrologers(records, 0).map((a) => a.id),
    );
  });
  testWidgets(
    'empty pool shows unavailable state without invented identities',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FreeChatAvatars(records: const [], onSelect: (_) async {}),
          ),
        ),
      );
      expect(
        find.text('No eligible astrologers are available right now.'),
        findsOneWidget,
      );
      expect(find.byType(AstrologerDefaultAvatar), findsNothing);
    },
  );
  testWidgets(
    'exact ID callback, accessible avatars and duplicate-tap fencing',
    (tester) async {
      final taps = <String>[];
      final route = Completer<void>();
      final semantics = tester.ensureSemantics();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: FreeChatAvatars(
              records: [record('canonical')],
              onSelect: (a) async {
                taps.add(a.id);
                await route.future;
              },
            ),
          ),
        ),
      );
      expect(
        find.bySemanticsLabel(RegExp('Illustrated default astrologer avatar')),
        findsOneWidget,
      );
      await tester.tap(find.text('Synthetic canonical'));
      await tester.pump();
      await tester.tap(find.text('Synthetic canonical'));
      expect(taps, ['canonical']);
      route.complete();
      await tester.pump();
      semantics.dispose();
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('five portraits paint at small size without overflow', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Row(
            children: [
              for (var i = 0; i < 5; i++)
                SizedBox(
                  width: 40,
                  height: 40,
                  child: AstrologerDefaultAvatar(astrologerId: 'id-$i'),
                ),
            ],
          ),
        ),
      ),
    );
    expect(find.byType(AstrologerDefaultAvatar), findsNWidgets(5));
    expect(tester.takeException(), isNull);
  });
}
