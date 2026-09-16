import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class CategoryAiResponse {
  const CategoryAiResponse({
    required this.category,
    required this.answer,
    required this.grounded,
    required this.source,
    this.kundliId,
  });

  final String category;
  final String answer;
  final bool grounded;
  final String source;
  final String? kundliId;

  factory CategoryAiResponse.fromJson(Map<String, dynamic> json) {
    final answer = json['answer']?.toString().trim() ?? '';

    if (answer.isEmpty) {
      throw const CategoryAiApiException(
        'ASP AI returned an empty response. Please try again.',
      );
    }

    return CategoryAiResponse(
      category: json['category']?.toString().trim() ?? '',
      answer: answer,
      grounded: json['grounded'] == true,
      source: json['source']?.toString().trim() ?? '',
      kundliId: json['kundliId']?.toString().trim(),
    );
  }
}

class CategoryAiApiException implements Exception {
  const CategoryAiApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class CategoryAiApi {
  CategoryAiApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<CategoryAiResponse> ask({
    required String category,
    required String question,
    String language = 'en',
  }) async {
    final cleanCategory = category.trim();
    final cleanQuestion = question.trim();
    final cleanLanguage = language.trim().isEmpty ? 'en' : language.trim();

    if (cleanCategory.isEmpty) {
      throw const CategoryAiApiException(
        'Please select an astrology category.',
      );
    }

    if (cleanQuestion.isEmpty) {
      throw const CategoryAiApiException('Please enter your question.');
    }

    if (cleanQuestion.length > 1200) {
      throw const CategoryAiApiException(
        'Please keep your question within 1200 characters.',
      );
    }

    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const CategoryAiApiException(
        'Please login again to continue.',
        loginRequired: true,
      );
    }

    final firstResponse = await _send(
      token: token,
      category: cleanCategory,
      question: cleanQuestion,
      language: cleanLanguage,
    );

    if (firstResponse.statusCode != 401) {
      return _parse(firstResponse);
    }

    /*
     * Same production session strategy as the rest of ASP:
     * if backend rejects an expired access token, perform one explicit
     * refresh and retry exactly once.
     */
    final refreshedSession = await _sessionStore.forceRefresh();
    final refreshedToken = refreshedSession?.accessToken.trim() ?? '';

    if (refreshedToken.isEmpty) {
      throw const CategoryAiApiException(
        'Your session has expired. Please login again.',
        loginRequired: true,
      );
    }

    final retryResponse = await _send(
      token: refreshedToken,
      category: cleanCategory,
      question: cleanQuestion,
      language: cleanLanguage,
    );

    return _parse(retryResponse);
  }

  Future<http.Response> _send({
    required String token,
    required String category,
    required String question,
    required String language,
  }) {
    return _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/kundli/category-ai/ask'),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'category': category,
            'question': question,
            'lang': language,
          }),
        )
        .timeout(ApiConfig.requestTimeout);
  }

  CategoryAiResponse _parse(http.Response response) {
    final body = _decode(response.body);

    if (response.statusCode == 401) {
      throw const CategoryAiApiException(
        'Your session has expired. Please login again.',
        loginRequired: true,
      );
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw CategoryAiApiException(
        _message(
          body,
          'Unable to get personalized guidance right now. Please try again.',
        ),
      );
    }

    return CategoryAiResponse.fromJson(body);
  }

  Map<String, dynamic> _decode(String raw) {
    if (raw.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(raw);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // Converted to a user-safe API error by the caller.
    }

    return <String, dynamic>{};
  }

  String _message(Map<String, dynamic> body, String fallback) {
    final direct = body['message'];

    if (direct is String && direct.trim().isNotEmpty) {
      return direct.trim();
    }

    if (direct is List) {
      final messages = direct
          .map((item) => item.toString().trim())
          .where((item) => item.isNotEmpty)
          .toList(growable: false);

      if (messages.isNotEmpty) {
        return messages.join('\n');
      }
    }

    final error = body['error'];

    if (error is String && error.trim().isNotEmpty) {
      return error.trim();
    }

    return fallback;
  }

  void dispose() {
    _client.close();
  }
}
