import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'app_preferences.dart';

class PreferencesApiException implements Exception {
  const PreferencesApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class PreferencesApi {
  PreferencesApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<AppPreferences> getPreferences() async {
    final body = await _request(
      method: 'GET',
      path: '/profile/preferences',
      fallbackError: 'Failed to load preferences.',
    );

    return _readPreferences(body);
  }

  Future<AppPreferences> updatePreferences({
    required String chartStyle,
    required String monthType,
    required bool darkMode,
    required bool hideOuterPlanets,
    required bool customCalendar,
  }) async {
    final body = await _request(
      method: 'PATCH',
      path: '/profile/preferences',
      payload: <String, dynamic>{
        'chartStyle': chartStyle,
        'monthType': monthType,
        'darkMode': darkMode,
        'hideOuterPlanets': hideOuterPlanets,
        'customCalendar': customCalendar,
      },
      fallbackError: 'Failed to save preferences.',
    );

    return _readPreferences(body);
  }

  AppPreferences _readPreferences(Map<String, dynamic> body) {
    final rawData = body['data'];

    if (rawData is Map<String, dynamic>) {
      return AppPreferences.fromJson(rawData);
    }

    if (rawData is Map) {
      return AppPreferences.fromJson(Map<String, dynamic>.from(rawData));
    }

    throw const PreferencesApiException(
      'The server returned an invalid preferences response.',
    );
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? payload,
    required String fallbackError,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const PreferencesApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll(<String, String>{
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamedResponse = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);

      final response = await http.Response.fromStream(streamedResponse);

      final Map<String, dynamic> body;
      if (response.body.trim().isEmpty) {
        body = <String, dynamic>{};
      } else {
        final decoded = jsonDecode(response.body);

        if (decoded is Map<String, dynamic>) {
          body = decoded;
        } else if (decoded is Map) {
          body = Map<String, dynamic>.from(decoded);
        } else {
          body = <String, dynamic>{};
        }
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return body;
      }

      final message = body['message']?.toString().trim().isNotEmpty == true
          ? body['message'].toString().trim()
          : fallbackError;

      throw PreferencesApiException(
        message,
        loginRequired: response.statusCode == 401 || response.statusCode == 403,
      );
    } on PreferencesApiException {
      rethrow;
    } catch (_) {
      throw PreferencesApiException(fallbackError);
    }
  }

  void close() {
    _client.close();
  }
}
