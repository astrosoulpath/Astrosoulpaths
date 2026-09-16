import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import '../models/astrology_question_models.dart';

class AstrologyQuestionsApiException implements Exception {
  const AstrologyQuestionsApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AstrologyQuestionsApi {
  AstrologyQuestionsApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<List<AstrologyQuestionCategory>> getCategories() async {
    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/astrology-questions/categories'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AstrologyQuestionsApiException(
          _readMessage(body, fallback: 'Unable to load astrology categories.'),
        );
      }

      final data = body['data'];

      if (data is! List) {
        throw const AstrologyQuestionsApiException(
          'Invalid astrology categories response.',
        );
      }

      return data
          .whereType<Map>()
          .map(
            (item) => AstrologyQuestionCategory.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList();
    } on AstrologyQuestionsApiException {
      rethrow;
    } catch (_) {
      throw const AstrologyQuestionsApiException(
        'Unable to connect to astrology question service.',
      );
    }
  }

  Future<AstrologyQuestionCategoryDetails> getQuestions(String slug) async {
    try {
      final response = await _client
          .get(
            Uri.parse(
              '${ApiConfig.baseUrl}/astrology-questions/categories/$slug/questions',
            ),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AstrologyQuestionsApiException(
          _readMessage(body, fallback: 'Unable to load astrology questions.'),
        );
      }

      final data = body['data'];

      if (data is! Map) {
        throw const AstrologyQuestionsApiException(
          'Invalid astrology questions response.',
        );
      }

      final mappedData = Map<String, dynamic>.from(data);

      final rawCategory = mappedData['category'];
      final rawQuestions = mappedData['questions'];

      if (rawCategory is! Map || rawQuestions is! List) {
        throw const AstrologyQuestionsApiException(
          'Invalid astrology questions response.',
        );
      }

      final categoryJson = Map<String, dynamic>.from(rawCategory);

      categoryJson['sortOrder'] = 0;
      categoryJson['questionCount'] = rawQuestions.length;

      final questions = rawQuestions
          .whereType<Map>()
          .map(
            (item) =>
                AstrologyQuestion.fromJson(Map<String, dynamic>.from(item)),
          )
          .toList();

      return AstrologyQuestionCategoryDetails(
        category: AstrologyQuestionCategory.fromJson(categoryJson),
        questions: questions,
      );
    } on AstrologyQuestionsApiException {
      rethrow;
    } catch (_) {
      throw const AstrologyQuestionsApiException(
        'Unable to connect to astrology question service.',
      );
    }
  }

  Map<String, dynamic> _decodeBody(String source) {
    if (source.trim().isEmpty) {
      return <String, dynamic>{};
    }

    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Consistent API error is returned by the caller.
    }

    return <String, dynamic>{};
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final message = body['message'];

    if (message is String && message.trim().isNotEmpty) {
      return message.trim();
    }

    if (message is List && message.isNotEmpty) {
      return message.map((item) => item.toString()).join('\n');
    }

    return fallback;
  }

  Future<Map<String, dynamic>> generateAnswer({
    required String questionId,
    required String categorySlug,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AstrologyQuestionsApiException('Please login to continue.');
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/astrology-questions/answer'),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({
              'questionId': questionId,
              'categorySlug': categorySlug,
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AstrologyQuestionsApiException(
          _readMessage(
            body,
            fallback: 'Unable to generate astrology guidance.',
          ),
        );
      }

      return body;
    } on AstrologyQuestionsApiException {
      rethrow;
    } catch (_) {
      throw const AstrologyQuestionsApiException(
        'Unable to connect to AI astrology service.',
      );
    }
  }

  void close() {
    _client.close();
  }
}
