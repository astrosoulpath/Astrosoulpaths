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

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const FeedbackApiException('Please login again to continue.');
    }

    return token;
  }

  Future<Map<String, dynamic>> submit({
    required String category,
    required int rating,
    required String message,
  }) async {
    final token = await _accessToken();

    final response = await _client.post(
      Uri.parse('${ApiConfig.baseUrl}/feedback'),
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'category': category,
        'rating': rating,
        'message': message.trim(),
      }),
    );

    return _decode(response);
  }

  Future<List<Map<String, dynamic>>> getMine() async {
    final token = await _accessToken();

    final response = await _client.get(
      Uri.parse('${ApiConfig.baseUrl}/feedback/my'),
      headers: {'Accept': 'application/json', 'Authorization': 'Bearer $token'},
    );

    final decoded = _decode(response);
    final raw = decoded['data'];

    if (raw is! List) {
      return const [];
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
