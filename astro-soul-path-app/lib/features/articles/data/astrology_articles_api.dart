import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'astrology_article.dart';

class AstrologyArticlesApi {
  AstrologyArticlesApi({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<AstrologyArticle>> getPublishedArticles({
    required String locale,
    String? country,
    int limit = 10,
  }) async {
    final query = <String, String>{'locale': locale, 'limit': '$limit'};

    if (country?.trim().isNotEmpty == true) {
      query['country'] = country!.trim().toUpperCase();
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/articles',
    ).replace(queryParameters: query);

    final response = await _client.get(
      uri,
      headers: const {'Accept': 'application/json'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Unable to load articles (${response.statusCode}).');
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! List) return const [];

    return decoded
        .whereType<Map<String, dynamic>>()
        .map(AstrologyArticle.fromJson)
        .toList();
  }

  Future<List<AstrologyArticle>> getAstrologerPublishedArticles({
    required String astrologerId,
    required String locale,
    String? country,
    int limit = 20,
  }) async {
    final id = astrologerId.trim();

    if (id.isEmpty) {
      throw ArgumentError('Astrologer id is required.');
    }

    final query = <String, String>{
      'locale': locale.trim().isEmpty ? 'en' : locale.trim().toLowerCase(),
      'limit': '$limit',
    };

    if (country?.trim().isNotEmpty == true) {
      query['country'] = country!.trim().toUpperCase();
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/articles/astrologer/${Uri.encodeComponent(id)}',
    ).replace(queryParameters: query);

    final response = await _client.get(
      uri,
      headers: const {'Accept': 'application/json'},
    );

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        'Unable to load astrologer posts (${response.statusCode}).',
      );
    }

    final decoded = jsonDecode(response.body);

    if (decoded is! List) {
      return const <AstrologyArticle>[];
    }

    return decoded
        .whereType<Map>()
        .map(
          (item) => AstrologyArticle.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }

  void close() => _client.close();
}
