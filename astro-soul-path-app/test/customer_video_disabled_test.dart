import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/customer/data/customer_consultation_api.dart';
import 'package:astro_soul_path/features/consultations/data/consultation_api.dart';
import 'package:astro_soul_path/features/consultations/data/consultation_models.dart';
import 'package:astro_soul_path/features/consultations/presentation/screens/consultation_confirmation_screen.dart';
import 'package:astro_soul_path/features/astrologers/data/astrologer_api.dart';
import 'package:astro_soul_path/features/astrologers/data/public_astrologer.dart';
import 'package:astro_soul_path/features/astrologers/presentation/widgets/premium_astrologer_services.dart';
import 'package:astro_soul_path/features/astrologers/presentation/screens/astrologer_detail_screen.dart';

final profile = PublicAstrologerProfile.fromJson({
  'id': 'synthetic-profile',
  'userId': 'synthetic-astro',
  'name': 'Synthetic approved astrologer',
  'isOnline': true,
  'isBusy': false,
  'isVerified': true,
  'experience': 8,
  'pricePerMin': 17,
  'languages': ['English'],
  'expertise': ['Vedic'],
  'consultationOptions': {'chat': true, 'audioCall': true, 'videoCall': true},
});

class Profiles extends AstrologerApi {
  @override
  Future<PublicAstrologerProfile> getPublicAstrologerById(String id) async =>
      profile;
}

void main() {
  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  test(
    'backend video capability is preserved as data but cannot enable new customer video',
    () {
      expect(profile.consultationOptions.videoCall, true);
      expect(profile.canRequestVideo, false);
      expect(profile.canRequestChat, true);
      expect(profile.canRequestAudio, true);
    },
  );
  test(
    'both customer start adapters reject video before network or authentication side effects',
    () async {
      var requests = 0;
      http.Client client() => MockClient((_) async {
        requests++;
        return http.Response('{}', 500);
      });
      final customer = CustomerConsultationApi(client: client());
      final shared = ConsultationApi(client: client());
      await expectLater(
        customer.startConsultation(
          astrologerUserId: 'synthetic',
          purchasedMinutes: 1,
          mode: CustomerConsultationMode.video,
        ),
        throwsA(isA<CustomerConsultationApiException>()),
      );
      await expectLater(
        shared.startConsultation(
          astrologerUserId: 'synthetic',
          purchasedMinutes: 1,
          mode: ConsultationMode.video,
        ),
        throwsA(isA<ConsultationApiException>()),
      );
      expect(requests, 0);
      customer.close();
      shared.close();
    },
  );
  testWidgets('services have chat/audio only, without an empty video row', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: PremiumAstrologerServices(profile: profile),
          ),
        ),
      ),
    );
    expect(find.text('Chat Consultation'), findsOneWidget);
    expect(find.text('Audio Call'), findsOneWidget);
    expect(find.text('Video Call'), findsNothing);
    expect(find.byIcon(Icons.videocam_rounded), findsNothing);
    expect(tester.takeException(), isNull);
  });
  testWidgets(
    'a stale video confirmation route cannot show a purchase action',
    (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: ConsultationConfirmationScreen(
            profile: profile,
            mode: ConsultationMode.video,
          ),
        ),
      );
      expect(find.text('Consultation unavailable'), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
      expect(find.byType(DropdownButton<int>), findsNothing);
    },
  );
  for (final width in [320.0, 430.0]) {
    testWidgets(
      'actual customer profile at ${width}dp retains Chat/Audio, hides Video',
      (tester) async {
        tester.view.physicalSize = Size(width, 1000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await tester.pumpWidget(
          MaterialApp(
            home: AstrologerDetailScreen(
              astrologerId: 'synthetic-profile',
              api: Profiles(),
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Video Consultation'), findsNothing);
        expect(find.byIcon(Icons.videocam_rounded), findsNothing);
        expect(find.text('Chat Consultation'), findsWidgets);
        expect(find.text('Audio Consultation'), findsWidgets);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox());
      },
    );
  }
}
