import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class FeedbackApiException implements Exception {
  const FeedbackApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class FeedbackApi {
  FeedbackApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final int _revision = AuthSessionStore.sessionRevision;
  void _check() {
    if (_revision != AuthSessionStore.sessionRevision) {
      throw const FeedbackApiException(
        'Your account changed. Reopen feedback.',
      );
    }
  }

  void close() {
    _client.close();
  }

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<String> _accessToken() async {
    _check();
    final session = await _sessionStore.read();
    _check();
    if (session?.portal != 'customer') {
      throw const FeedbackApiException(
        'Sign in with your Customer account to send feedback.',
      );
    }
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const FeedbackApiException('Please login again to continue.');
    }

    return token;
  }

  Future<Map<String, dynamic>> submit({
    required String category,
    int? rating,
    required String message,
    String? consultationId,
  }) async {
    final token = await _accessToken();

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/feedback'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'category': category,
            'rating': ?rating,
            'message': message.trim(),
            'consultationId': ?consultationId,
          }),
        )
        .timeout(ApiConfig.requestTimeout);

    _check();
    final result = _decode(response);
    if (result['success'] != true) {
      throw const FeedbackApiException(
        'Feedback submission was not confirmed. Please retry.',
      );
    }
    return result;
  }

  Future<List<Map<String, dynamic>>> getMine({int page = 1}) async {
    final token = await _accessToken();

    final response = await _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}/feedback/my?page=$page'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
        )
        .timeout(ApiConfig.requestTimeout);

    _check();
    final decoded = _decode(response);
    final raw = decoded['data'];

    if (raw is! List) {
      throw const FeedbackApiException(
        'Feedback history could not be verified. Please retry.',
      );
    }

    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> body = {};

    try {
      final decoded = jsonDecode(response.body);

      if (decoded is Map<String, dynamic>) {
        body = decoded;
      } else if (decoded is Map) {
        body = Map<String, dynamic>.from(decoded);
      }
    } catch (_) {}

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final message =
          body['message']?.toString().trim() ??
          'Something went wrong. Please try again.';

      throw FeedbackApiException(message);
    }

    return body;
  }
}
