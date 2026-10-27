import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:astro_soul_path/features/kundli/data/kundli_pdf_export.dart';
import 'package:astro_soul_path/features/kundli/presentation/screens/kundli_pdf_preview_screen.dart';

Uint8List pdf() =>
    Uint8List.fromList('%PDF-1.7\noriginal report content\n%%EOF\n'.codeUnits);

void main() {
  test(
    'same filename with different report bytes cannot share pdfrx cache key',
    () {
      final first = PdfDocumentRefData(
        pdf(),
        sourceName: newKundliPdfPreviewSourceName(),
      );
      final second = PdfDocumentRefData(
        Uint8List.fromList('%PDF-1.7\nupdated report\n%%EOF\n'.codeUnits),
        sourceName: newKundliPdfPreviewSourceName(),
      );
      expect(first.key, isNot(second.key));
      expect(first.data, isNot(orderedEquals(second.data)));
    },
  );
  test('valid PDF signature and EOF required', () {
    expect(isValidKundliPdf(pdf()), isTrue);
    for (final invalid in [
      '',
      '<html>unauthorized</html>',
      '%PDF-1.7\npartial',
    ]) {
      expect(isValidKundliPdf(Uint8List.fromList(invalid.codeUnits)), isFalse);
    }
  });
  test('safe filenames cannot escape destination or repeat extension', () {
    expect(safeKundliPdfName('../../report.PDF'), 'report.pdf');
    expect(safeKundliPdfName(''), 'kundli-report.pdf');
    expect(safeKundliPdfName('birth:name?.pdf'), 'birth_name_.pdf');
    expect(safeKundliPdfName('a' * 150).length, lessThanOrEqualTo(84));
  });
  for (final platform in ['Android', 'iOS']) {
    for (final outcome in ['success', 'cancel', 'failure']) {
      testWidgets(
        '$platform mocked export $outcome preserves bytes and truthful notification',
        (tester) async {
          final bytes = pdf();
          Uint8List? shown;
          Uint8List? saved;
          await tester.pumpWidget(
            MaterialApp(
              home: KundliPdfPreviewScreen(
                bytes: bytes,
                fileName: '../private.pdf',
                previewBuilder: (data) {
                  shown = data;
                  return const Text('PDF pages');
                },
                savePdf: (data, name) async {
                  saved = data;
                  expect(name, 'private.pdf');
                  if (outcome == 'failure') throw StateError('write failure');
                  return outcome == 'cancel' ? null : 'saved-destination';
                },
              ),
            ),
          );
          await tester.tap(find.text('Download PDF'));
          await tester.pumpAndSettle();
          expect(saved, orderedEquals(bytes));
          expect(identical(shown, saved), isTrue);
          expect(
            find.text('PDF saved successfully'),
            outcome == 'success' ? findsOneWidget : findsNothing,
          );
          if (outcome == 'cancel') {
            expect(find.text('PDF save cancelled.'), findsOneWidget);
          }
          if (outcome == 'failure') {
            expect(
              find.text('Unable to download PDF. Please try again.'),
              findsOneWidget,
            );
          }
        },
      );
    }
  }
  testWidgets(
    'duplicate taps blocked and source mutation cannot change preview/export',
    (tester) async {
      final bytes = pdf();
      final expected = Uint8List.fromList(bytes);
      final pending = Completer<String?>();
      var calls = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: KundliPdfPreviewScreen(
            bytes: bytes,
            fileName: 'kundli.pdf',
            previewBuilder: (_) => const Text('PDF'),
            savePdf: (data, name) {
              calls++;
              expect(data, orderedEquals(expected));
              return pending.future;
            },
          ),
        ),
      );
      bytes.fillRange(0, bytes.length, 0);
      await tester.tap(find.text('Download PDF'));
      await tester.pump();
      expect(
        tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull,
      );
      expect(calls, 1);
      pending.complete(null);
      await tester.pumpAndSettle();
    },
  );
  testWidgets('invalid PDF blocks download and gives a clear error', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: KundliPdfPreviewScreen(bytes: Uint8List(0), fileName: 'bad.pdf'),
      ),
    );
    expect(find.textContaining('Invalid or incomplete PDF'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
      isNull,
    );
  });
  testWidgets('320px and 2x text retains bottom download action', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 640);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: KundliPdfPreviewScreen(
            bytes: pdf(),
            fileName: 'report.pdf',
            previewBuilder: (_) => const Text('PDF pages'),
          ),
        ),
      ),
    );
    expect(find.text('Download PDF'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
