import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/horoscope/data/general_horoscope_api.dart';
import 'package:astro_soul_path/features/horoscope/presentation/screens/general_horoscope_screen.dart';
import 'package:astro_soul_path/core/widgets/golden_sparkle_loading.dart';

void main() {
  testWidgets(
    'real period switches follow request completion and cached periods need no loader',
    (tester) async {
      final requests = <String>[];
      final pending = <String, Completer<http.Response>>{};
      final api = GeneralHoroscopeApi(
        client: MockClient((request) {
          final period = request.url.path.split('/').last;
          requests.add(period);
          return (pending[period] = Completer<http.Response>()).future;
        }),
      );
      await tester.pumpWidget(
        MaterialApp(home: GeneralHoroscopeScreen(api: api)),
      );
      await tester.pump();
      expect(find.byType(GoldenSparkle), findsOneWidget);
      pending['daily']!.complete(
        http.Response(
          '{"interpretation":{"summary":"Synthetic daily context"}}',
          200,
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 250));
      for (final period in ['Weekly', 'Monthly', 'Yearly']) {
        final tab = find.text(period).first;
        await tester.ensureVisible(tab);
        await tester.tap(tab);
        await tester.pump();
        expect(find.byType(GoldenSparkle), findsOneWidget);
        expect(find.byType(ListView), findsWidgets);
        final before = requests.length;
        await tester.tap(
          find.text(period == 'Weekly' ? 'Daily' : 'Weekly').first,
          warnIfMissed: false,
        );
        await tester.pump();
        expect(requests.length, before);
        pending[period.toLowerCase()]!.complete(
          http.Response(
            '{"interpretation":{"summary":"Synthetic ${period.toLowerCase()} context"}}',
            200,
          ),
        );
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 250));
        expect(find.byType(GoldenSparkle), findsNothing);
      }
      final before = requests.length;
      await tester.ensureVisible(find.text('Daily').first);
      await tester.tap(find.text('Daily').first);
      await tester.pump();
      expect(requests.length, before);
      expect(find.byType(GoldenSparkle), findsNothing);
      await tester.pumpWidget(const SizedBox());
      expect(tester.takeException(), isNull);
    },
  );
}
