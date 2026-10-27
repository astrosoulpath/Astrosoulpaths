import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import '../../features/auth/data/auth_session_store.dart';
import '../config/api_config.dart';
import 'notification_session_fence.dart';

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
    final generation = NotificationSessionFence.generation;
    final token = fcmToken.trim();

    if (token.isEmpty) {
      return;
    }

    final session = await _sessionStore.read();

    if (session == null || session.accessToken.trim().isEmpty) {
      return;
    }

    final platform = Platform.isIOS ? 'IOS' : 'ANDROID';
    if (NotificationSessionFence.suspended ||
        generation != NotificationSessionFence.generation) {
      return;
    }

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

  Future<void> unregisterDevice({
    required String fcmToken,
    required String accessToken,
  }) async {
    if (fcmToken.trim().isEmpty || accessToken.trim().isEmpty) return;
    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/notifications/devices/unregister'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
          body: jsonEncode({'fcmToken': fcmToken}),
        )
        .timeout(ApiConfig.requestTimeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw const NotificationDeviceApiException(
        'Device unbinding could not be confirmed.',
      );
    }
  }

  Future<void> sendTestPush() async {
    final session = await _sessionStore.read();

    if (session == null || session.accessToken.trim().isEmpty) {
      throw const NotificationDeviceApiException(
        'Login session not available.',
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/notifications/test-push'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${session.accessToken}',
          },
        )
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw NotificationDeviceApiException(
        'Test notification failed (${response.statusCode}).',
      );
    }
  }

  void close() {
    _client.close();
  }
}
