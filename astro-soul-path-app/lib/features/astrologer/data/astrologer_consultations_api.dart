import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class AstrologerConsultationsApiException implements Exception {
  const AstrologerConsultationsApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AstrologerConsultationsApi {
  AstrologerConsultationsApi({
    http.Client? client,
    AuthSessionStore? sessionStore,
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<Map<String, dynamic>> getCurrent() {
    return _request(method: 'GET', path: '/consultations/astrologer/current');
  }

  Future<Map<String, dynamic>> getHistory() {
    return _request(method: 'GET', path: '/consultations/astrologer/history');
  }

  Future<Map<String, dynamic>> accept(String consultationId) {
    return _request(
      method: 'PATCH',
      path: '/consultations/${Uri.encodeComponent(_id(consultationId))}/accept',
    );
  }

  Future<Map<String, dynamic>> reject(String consultationId) {
    return _request(
      method: 'PATCH',
      path: '/consultations/${Uri.encodeComponent(_id(consultationId))}/reject',
    );
  }

  Future<Map<String, dynamic>> complete(String consultationId) {
    return _request(
      method: 'PATCH',
      path:
          '/consultations/${Uri.encodeComponent(_id(consultationId))}/complete',
    );
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
  }) async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const AstrologerConsultationsApiException(
        'Please login again to access consultations.',
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      });

      final streamed = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);

      final response = await http.Response.fromStream(streamed);

      final body = _decode(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body['success'] == true) {
        return body;
      }

      throw AstrologerConsultationsApiException(
        _message(
          body,
          response.statusCode == 401
              ? 'Your session has expired. Please login again.'
              : 'Consultation request failed.',
        ),
      );
    } on AstrologerConsultationsApiException {
      rethrow;
    } catch (_) {
      throw const AstrologerConsultationsApiException(
        'Unable to connect to consultations. Please try again.',
      );
    }
  }

  String _id(String source) {
    final value = source.trim();

    if (value.isEmpty) {
      throw const AstrologerConsultationsApiException(
        'Consultation ID is missing.',
      );
    }

    return value;
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
    final value = body['message'];

    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    if (value is List && value.isNotEmpty) {
      return value.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
