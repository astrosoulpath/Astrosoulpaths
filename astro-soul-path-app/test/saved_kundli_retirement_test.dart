import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/kundli/data/kundli_api.dart';
import 'package:astro_soul_path/features/kundli/presentation/screens/astrologer_saved_kundli_detail_screen.dart';

class _SavedApi extends KundliApi {
  _SavedApi(this.complete);
  final bool complete;
  int regenerationRequests = 0;

  @override
  Future<ProfessionalSavedKundliDetail> getProfessionalSavedKundli({
    required String savedRecordId,
  }) async => ProfessionalSavedKundliDetail.fromJson({
    'id': savedRecordId,
    'name': 'Synthetic chart',
    'report': {
      'status': complete ? 'COMPLETE' : 'INCOMPLETE',
      'completeness': {'corePercent': complete ? 100 : 50},
    },
  });

  @override
  Future<void> regenerateProfessionalSavedKundli({
    required String savedRecordId,
  }) async {
    regenerationRequests++;
    throw StateError('Retired route must never be called');
  }
}

void main() {
  for (final complete in [false, true]) {
    testWidgets(
      'saved chart complete=$complete never offers retired generation',
      (tester) async {
        final api = _SavedApi(complete);
        await tester.pumpWidget(
          MaterialApp(
            home: AstrologerSavedKundliDetailScreen(
              savedRecordId: 'synthetic',
              api: api,
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Synthetic chart'), findsWidgets);
        expect(find.text('Regenerate Report'), findsNothing);
        final pdfAction = tester.widget<IconButton>(
          find.byWidgetPredicate(
            (widget) => widget is IconButton && widget.tooltip == 'PDF',
          ),
        );
        expect(pdfAction.onPressed != null, complete);
        if (!complete) {
          await tester.scrollUntilVisible(
            find.text('View Consultation Reports'),
            300,
          );
          expect(
            find.textContaining('Provider regeneration is retired.'),
            findsOneWidget,
          );
        }
        expect(api.regenerationRequests, 0);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
