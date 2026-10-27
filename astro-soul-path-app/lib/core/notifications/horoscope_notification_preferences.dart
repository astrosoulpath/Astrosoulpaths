import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import '../../features/auth/data/auth_session_store.dart';
import '../config/api_config.dart';

class HoroscopeNotificationPreference {
  const HoroscopeNotificationPreference({
    required this.enabled,
    required this.available,
    this.eligible = true,
    this.deliveryReady = true,
    this.subscriptionStatus = 'ACTIVE',
    this.expiresAt,
  });
  final bool enabled;
  final bool available;
  final bool eligible;
  final bool deliveryReady;
  final String subscriptionStatus;
  final DateTime? expiresAt;
}

class HoroscopeNotificationPreferences {
  HoroscopeNotificationPreferences({
    http.Client? client,
    Future<String?> Function()? tokenLoader,
  }) : _client = client ?? http.Client(),
       _tokenLoader =
           tokenLoader ??
           (() async => (await AuthSessionStore().restore(
             portal: 'customer',
           ))?.accessToken);
  final http.Client _client;
  final Future<String?> Function() _tokenLoader;
  Future<HoroscopeNotificationPreference> load() => _request(null);
  Future<HoroscopeNotificationPreference> save(bool enabled) =>
      _request(enabled);
  Future<HoroscopeNotificationPreference> _request(bool? enabled) async {
    final revision = AuthSessionStore.sessionRevision;
    final token = await _tokenLoader();
    if (revision != AuthSessionStore.sessionRevision) {
      throw StateError('Session changed. Reload reminder settings.');
    }
    if (token == null || token.trim().isEmpty) {
      throw StateError('Please sign in to manage reminders.');
    }
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/notifications/horoscope-preference',
    );
    final headers = {
      'Authorization': 'Bearer $token',
      'Content-Type': 'application/json',
    };
    final response =
        await (enabled == null
                ? _client.get(uri, headers: headers)
                : _client.patch(
                    uri,
                    headers: headers,
                    body: jsonEncode({'enabled': enabled}),
                  ))
            .timeout(ApiConfig.requestTimeout);
    if (revision != AuthSessionStore.sessionRevision) {
      throw StateError('Session changed. Reload reminder settings.');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('Reminders could not be updated. Please try again.');
    }
    final body = jsonDecode(response.body);
    if (body is! Map || body['success'] != true || body['data'] is! Map) {
      throw StateError('Reminders are unavailable.');
    }
    final data = body['data'] as Map;
    if (kDebugMode) {
      debugPrint(
        'HOROSCOPE_REMINDER_STATE ${jsonEncode({
          'httpStatus': response.statusCode,
          'status': const ['NOT_ACTIVATED', 'RECORDED'].contains(data['status']) ? data['status'] : 'UNKNOWN',
          'eligible': data['eligible'] == true,
          'deliveryReady': data['deliveryReady'] == true,
        })}',
      );
    }
    if (data['enabled'] is! bool) {
      throw StateError('Reminders are unavailable.');
    }
    return HoroscopeNotificationPreference(
      enabled: data['enabled'] == true,
      available: data['status'] != 'NOT_ACTIVATED',
      eligible: data['eligible'] == true,
      deliveryReady: data['deliveryReady'] == true,
      subscriptionStatus: data['subscriptionStatus']?.toString() ?? 'UNKNOWN',
      expiresAt: DateTime.tryParse(data['expiresAt']?.toString() ?? ''),
    );
  }

  void close() => _client.close();
}
