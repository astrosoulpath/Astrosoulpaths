import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:astro_soul_path/app/astro_soul_path_app.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
  });

  testWidgets('unified role selection screen is displayed when logged out', (
    tester,
  ) async {
    await tester.pumpWidget(const AstroSoulPathApp());

    await tester.pumpAndSettle();

    expect(find.text('Astro Soul Path'), findsOneWidget);

    expect(find.text('Continue as Customer'), findsOneWidget);

    expect(find.text('Astrologer Login'), findsOneWidget);

    expect(find.text('Join as Astrologer'), findsOneWidget);
  });
}
