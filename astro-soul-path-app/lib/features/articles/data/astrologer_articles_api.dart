import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class AstrologerArticlesApiException implements Exception {
  const AstrologerArticlesApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AstrologerArticlesApi {
  AstrologerArticlesApi({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  Map<String, String> _headers(String accessToken) {
    final token = accessToken.trim();

    if (token.isEmpty) {
      throw const AstrologerArticlesApiException(
        'Your login session has expired. Please login again.',
      );
    }

    return {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<List<Map<String, dynamic>>> getMyArticles({
    required String accessToken,
  }) async {
    final response = await _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}/astrologer/articles'),
          headers: _headers(accessToken),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerArticlesApiException(
        _message(decoded, 'Unable to load your articles.'),
      );
    }

    final data = _extractList(decoded);

    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<Map<String, dynamic>> submitArticle({
    required String accessToken,
    required String slug,
    required String title,
    required String contentMarkdown,
    String locale = 'en',
    String? excerpt,
    String? coverImageUrl,
    String? category,
    String? authorName,
    int readingMinutes = 3,
  }) async {
    final payload = <String, dynamic>{
      'slug': slug.trim(),
      'defaultLocale': locale.trim(),
      if (coverImageUrl?.trim().isNotEmpty == true)
        'coverImageUrl': coverImageUrl!.trim(),
      if (category?.trim().isNotEmpty == true) 'category': category!.trim(),
      'translations': [
        {
          'locale': locale.trim(),
          'title': title.trim(),
          'contentMarkdown': contentMarkdown.trim(),
          if (excerpt?.trim().isNotEmpty == true) 'excerpt': excerpt!.trim(),
          if (authorName?.trim().isNotEmpty == true)
            'authorName': authorName!.trim(),
          'readingMinutes': readingMinutes,
        },
      ],
    };

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/astrologer/articles'),
          headers: _headers(accessToken),
          body: jsonEncode(payload),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerArticlesApiException(
        _message(decoded, 'Unable to submit article.'),
      );
    }

    return _extractMap(decoded);
  }

  Future<Map<String, dynamic>> updateArticle({
    required String accessToken,
    required String articleId,
    required Map<String, dynamic> payload,
  }) async {
    final id = articleId.trim();

    if (id.isEmpty) {
      throw const AstrologerArticlesApiException('Article id is missing.');
    }

    final response = await _client
        .patch(
          Uri.parse('${ApiConfig.baseUrl}/astrologer/articles/$id'),
          headers: _headers(accessToken),
          body: jsonEncode(payload),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerArticlesApiException(
        _message(decoded, 'Unable to update article.'),
      );
    }

    return _extractMap(decoded);
  }

  dynamic _decode(String source) {
    if (source.trim().isEmpty) return <String, dynamic>{};

    try {
      return jsonDecode(source);
    } catch (_) {
      return <String, dynamic>{'message': source};
    }
  }

  List<dynamic> _extractList(dynamic decoded) {
    if (decoded is List) return decoded;

    if (decoded is Map) {
      final map = Map<String, dynamic>.from(decoded);

      for (final key in const ['data', 'articles', 'items']) {
        final value = map[key];

        if (value is List) return value;

        if (value is Map) {
          final nested = Map<String, dynamic>.from(value);
          for (final nestedKey in const ['articles', 'items', 'data']) {
            if (nested[nestedKey] is List) {
              return nested[nestedKey] as List<dynamic>;
            }
          }
        }
      }
    }

    return const [];
  }

  Map<String, dynamic> _extractMap(dynamic decoded) {
    if (decoded is Map) {
      final map = Map<String, dynamic>.from(decoded);
      final data = map['data'];

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return map;
    }

    return <String, dynamic>{};
  }

  String _message(dynamic decoded, String fallback) {
    if (decoded is Map) {
      final map = Map<String, dynamic>.from(decoded);

      final message = map['message'];
      if (message is String && message.trim().isNotEmpty) {
        return message.trim();
      }

      if (message is List && message.isNotEmpty) {
        return message.join(', ');
      }

      final error = map['error'];
      if (error is String && error.trim().isNotEmpty) {
        return error.trim();
      }
    }

    return fallback;
  }

  void close() => _client.close();
}
