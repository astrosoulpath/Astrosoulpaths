// Separate opt-in debug entrypoint; never imported by the normal application.
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

Map<String, dynamic> sanitizeIdentityResult(dynamic decoded) {
  if (decoded is! Map) return {'failurePoint': 'DIAGNOSTIC_UNAVAILABLE'};
  const bools = {
    'sdkPresent',
    'storedPresent',
    'sdkVerified',
    'storedVerified',
    'sameIdentity',
    'cachedIdMatches',
    'adminUidMatches',
    'supportAllowed',
    'readOnly',
  };
  const values = {
    'INPUT',
    'COMPLETE',
    'CANONICAL_VERIFY',
    'CUSTOMER',
    'USER',
    'ASTROLOGER',
    'ADMIN',
    'UNKNOWN',
    'UNVERIFIED',
    'STORED_SESSION_VERIFICATION',
    'ADMIN_IDENTITY_NOT_ALLOWED',
    'ADMIN_CONFIG_MISSING',
    'ADMIN_MAPPING_REJECTED',
    'SINGLE_GOOGLE_ADMIN_POLICY',
    'CANONICAL_GUARD',
    'CUSTOMER_SUPPORT_ROLE_OR_APPROVAL',
    'NONE',
    'DIAGNOSTIC_FAILED',
  };
  return {
    for (final key in bools)
      if (decoded[key] is bool) key: decoded[key],
    for (final key in const ['stage', 'storedRole', 'sdkRole', 'failurePoint'])
      if (values.contains(decoded[key])) key: decoded[key],
    if (const [200, 401, 403, 503].contains(decoded['supportStatus']))
      'supportStatus': decoded['supportStatus'],
  };
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  var result = <String, dynamic>{'stage': 'DISABLED'};
  if (kDebugMode &&
      const bool.fromEnvironment('LOCAL_SUPPORT_IDENTITY_DIAGNOSTICS')) {
    var stage = 'FIREBASE_SDK';
    try {
      await Firebase.initializeApp();
      final user = await FirebaseAuth.instance.authStateChanges().first.timeout(
        const Duration(seconds: 15),
      );
      final uid = user?.uid;
      // Normal SDK token acquisition, no login/logout, user update or forced refresh.
      final sdkToken = await user?.getIdToken(false);
      stage = 'SECURE_SESSION_READ';
      const storage = FlutterSecureStorage();
      final storedToken = await storage.read(key: 'asp_access_token');
      final raw = await storage.read(key: 'asp_user');
      String? cachedId;
      try {
        cachedId = (jsonDecode(raw ?? '{}') as Map)['id']?.toString();
      } catch (_) {}
      stage = 'LOCAL_READ_ONLY_VERIFIER';
      final client = http.Client();
      try {
        final response = await client
            .post(
              Uri.parse('http://127.0.0.1:41179/identity'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'sdkToken': sdkToken,
                'sdkUid': uid,
                'storedToken': storedToken,
                'cachedId': cachedId,
              }),
            )
            .timeout(const Duration(seconds: 60));
        final decoded = jsonDecode(response.body);
        // Collector emits only this strict schema; never display arbitrary text.
        result = sanitizeIdentityResult(decoded);
      } finally {
        client.close();
      }
    } catch (_) {
      result = {'stage': stage, 'failurePoint': 'DIAGNOSTIC_UNAVAILABLE'};
    }
  }
  // Values are sanitized again by the collector and contain no identity data.
  debugPrint('SUPPORT_IDENTITY_RESULT=${jsonEncode(result)}');
  runApp(
    MaterialApp(
      home: Scaffold(
        appBar: AppBar(title: const Text('Local identity diagnostic')),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Text(const JsonEncoder.withIndent('  ').convert(result)),
        ),
      ),
    ),
  );
}
