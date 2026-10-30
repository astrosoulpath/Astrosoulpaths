// Temporary local debug entrypoint. Never imported by the normal application.
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Only the loopback verifier retains sanitized results; never display secrets.
  var outcome = 'DISABLED';
  var stage = 'INITIALIZE';
  if (kDebugMode &&
      const bool.fromEnvironment('LOCAL_HOROSCOPE_IDENTITY_DIAGNOSTICS')) {
    try {
      await Firebase.initializeApp().timeout(const Duration(seconds: 20));
      stage = 'AUTH_STATE';
      final user = await FirebaseAuth.instance.authStateChanges().first.timeout(
        const Duration(seconds: 15),
      );
      stage = 'SDK_TOKEN';
      final sdkToken = await user
          ?.getIdToken(false)
          .timeout(const Duration(seconds: 20));
      stage = 'STORED_TOKEN';
      const storage = FlutterSecureStorage();
      final storedToken = await storage
          .read(key: 'asp_access_token')
          .timeout(const Duration(seconds: 10));
      final messaging = FirebaseMessaging.instance;
      stage = 'NOTIFICATION_SETTINGS';
      final permission = await messaging.getNotificationSettings().timeout(
        const Duration(seconds: 15),
      );
      // Do not request permission, register a device, refresh context or restore
      // the normal app (its startup may synchronize records).
      stage = 'FCM_TOKEN';
      final fcmToken = await messaging.getToken().timeout(
        const Duration(seconds: 30),
      );
      stage = 'LOOPBACK_VERIFIER';
      final client = http.Client();
      try {
        final response = await client
            .post(
              Uri.parse('http://127.0.0.1:41179/horoscope-identity'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'sdkToken': sdkToken,
                'sdkUid': user?.uid,
                'storedToken': storedToken,
                'fcmToken': fcmToken,
                'notificationPermission':
                    permission.authorizationStatus ==
                    AuthorizationStatus.authorized,
              }),
            )
            .timeout(const Duration(seconds: 120));
        outcome = response.statusCode == 200 ? 'COMPLETE' : 'PROBE_REJECTED';
      } finally {
        client.close();
      }
    } catch (_) {
      outcome = 'PROBE_UNAVAILABLE_$stage';
    }
  }
  runApp(
    MaterialApp(
      home: Scaffold(
        body: Center(child: Text('Local read-only probe: $outcome')),
      ),
    ),
  );
}
