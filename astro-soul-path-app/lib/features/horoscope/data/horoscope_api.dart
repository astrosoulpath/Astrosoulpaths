import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class HoroscopeApiException implements Exception {
  const HoroscopeApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class HoroscopeApi {
  HoroscopeApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<Map<String, dynamic>> getDailyHoroscope({String day = 'today'}) async {
    final normalizedDay = day.trim().toLowerCase();

    if (!const ['yesterday', 'today', 'tomorrow'].contains(normalizedDay)) {
      throw const HoroscopeApiException('Invalid horoscope day selected.');
    }

    final body = await _request(
      path: '/dailyinsight?day=$normalizedDay',
      fallbackError: 'Unable to load daily horoscope.',
    );

    final data = body['data'];

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    throw const HoroscopeApiException('Invalid horoscope response received.');
  }

  Future<Map<String, dynamic>> _request({
    required String path,
    required String fallbackError,
  }) async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const HoroscopeApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      var response = await _send(path: path, token: token);

      // Production-safe:
      // If an access token expires between session-read and request,
      // refresh it once and retry exactly once.
      if (response.statusCode == 401) {
        final refreshed = await _sessionStore.forceRefresh();
        final refreshedToken = refreshed?.accessToken.trim() ?? '';

        if (refreshedToken.isEmpty) {
          throw const HoroscopeApiException(
            'Your session expired. Please login again.',
            loginRequired: true,
          );
        }

        response = await _send(path: path, token: refreshedToken);

        if (response.statusCode == 401) {
          throw const HoroscopeApiException(
            'Your session expired. Please login again.',
            loginRequired: true,
          );
        }
      }

      final body = _decode(response.body);

      if (response.statusCode == 403) {
        throw HoroscopeApiException(
          _message(body, 'You do not have access to this horoscope.'),
        );
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw HoroscopeApiException(_message(body, fallbackError));
      }

      return body;
    } on HoroscopeApiException {
      rethrow;
    } catch (_) {
      throw const HoroscopeApiException(
        'Unable to connect to horoscope service.',
      );
    }
  }

  Future<http.Response> _send({required String path, required String token}) {
    return _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}$path'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        )
        .timeout(ApiConfig.requestTimeout);
  }

  Map<String, dynamic> _decode(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}

    return <String, dynamic>{};
  }

  String _message(Map<String, dynamic> body, String fallback) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message;
    }

    final code = body['code'];

    if (code is String && code.trim().isNotEmpty) {
      return code;
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
