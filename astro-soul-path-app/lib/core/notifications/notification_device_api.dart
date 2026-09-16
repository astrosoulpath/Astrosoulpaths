import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../features/auth/data/auth_session_store.dart';
import '../config/api_config.dart';

class NotificationDeviceApiException implements Exception {
  const NotificationDeviceApiException(this.message);

  final String message;
}

class NotificationDeviceApi {
  NotificationDeviceApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<void> registerDevice({required String fcmToken}) async {
    final token = fcmToken.trim();

    if (token.isEmpty) {
      return;
    }

    final session = await _sessionStore.read();

    if (session == null || session.accessToken.trim().isEmpty) {
      return;
    }

    final platform = Platform.isIOS ? 'IOS' : 'ANDROID';

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/notifications/devices/register'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${session.accessToken}',
          },
          body: jsonEncode({'fcmToken': token, 'platform': platform}),
        )
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationDeviceApiException(
        'Unable to register notification device.',
      );
    }
  }

  void close() {
    _client.close();
  }
}
