import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/astrologer/presentation/widgets/partner_dashboard_widgets.dart';

void main() {
  test('missing and zero ratings are never invented', () {
    expect(partnerRatingLabel(null), 'No ratings yet');
    expect(partnerRatingLabel(0), 'No ratings yet');
    expect(partnerRatingLabel(4.7), 'Rating: 4.7');
  });
  for (final width in [320.0, 412.0]) {
    testWidgets(
      'quick actions reuse tool callbacks at width $width and 2x text',
      (tester) async {
        final selected = <String>[];
        const destinations = [
          'Consultations',
          'Go Live',
          'Availability',
          'Earnings',
        ];
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: const MediaQueryData(textScaler: TextScaler.linear(2)),
              child: Scaffold(
                body: SingleChildScrollView(
                  child: SizedBox(
                    width: width,
                    child: PartnerQuickActions(
                      tools: [
                        for (final title in destinations)
                          PartnerToolCard(
                            icon: Icons.star,
                            title: title,
                            subtitle: '',
                            onTap: () => selected.add(title),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        for (final label in ['Consult', 'Go Live', 'Schedule', 'Earnings']) {
          await tester.ensureVisible(find.text(label));
          await tester.tap(find.text(label));
        }
        expect(selected, destinations);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('quick Go Live retains disabled approval state', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PartnerQuickActions(
            tools: [
              PartnerToolCard(
                icon: Icons.live_tv,
                title: 'Go Live',
                subtitle: 'Approval required',
              ),
            ],
          ),
        ),
      ),
    );
    expect(tester.widget<InkWell>(find.byType(InkWell)).onTap, isNull);
  });
  const titles = [
    'Consultations',
    'Posts',
    'Profile',
    'Go Live',
    'Pricing',
    'Availability',
    'Earnings',
    'Customer History',
    'Kundali',
    'Reports',
    'Subscription',
    'Soul Bazaar Seller',
  ];
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'all tools reachable without overflow at 320px and text scale $scale',
      (tester) async {
        tester.view.physicalSize = const Size(320, 640);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        final taps = <String>[];
        await tester.pumpWidget(
          MaterialApp(
            home: MediaQuery(
              data: MediaQueryData(
                size: const Size(320, 640),
                textScaler: TextScaler.linear(scale),
              ),
              child: Scaffold(
                body: SingleChildScrollView(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: PartnerGrid(
                      children: [
                        for (final title in titles)
                          PartnerToolCard(
                            icon: Icons.star_outline,
                            title: title,
                            subtitle:
                                'Manage your professional astrology practice',
                            onTap: () => taps.add(title),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        for (final title in titles) {
          await tester.ensureVisible(find.text(title));
          await tester.pump();
          await tester.tap(find.text(title));
        }
        expect(taps, titles);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets('disabled tool cannot invoke navigation', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: PartnerToolCard(
            icon: Icons.live_tv,
            title: 'Go Live',
            subtitle: 'Approval and verification required',
          ),
        ),
      ),
    );
    final ink = tester.widget<InkWell>(find.byType(InkWell));
    expect(ink.onTap, isNull);
  });
  testWidgets(
    'metrics display supplied values without overflow at large text',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(textScaler: TextScaler.linear(2)),
            child: const Scaffold(
              body: SingleChildScrollView(
                child: SizedBox(
                  width: 280,
                  child: PartnerGrid(
                    children: [
                      PartnerMetric(
                        label: 'Total Earnings',
                        value: '₹1234567.89',
                        icon: Icons.account_balance_wallet,
                      ),
                      PartnerMetric(
                        label: 'Profile Completion',
                        value: '87%',
                        icon: Icons.person,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      expect(find.text('₹1234567.89'), findsOneWidget);
      expect(find.text('87%'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
