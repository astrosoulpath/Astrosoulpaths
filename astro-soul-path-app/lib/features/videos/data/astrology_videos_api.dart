import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'astrology_video.dart';

class AstrologyVideosApi {
  AstrologyVideosApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<AstrologyVideo>> getPublishedVideos({
    required String locale,
    String? country,
  }) async {
    final query = <String, String>{'locale': locale};

    if (country != null && country.trim().isNotEmpty) {
      query['country'] = country.trim().toUpperCase();
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/videos',
    ).replace(queryParameters: query);

    final response = await _client
        .get(uri, headers: const {'Accept': 'application/json'})
        .timeout(ApiConfig.requestTimeout);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Unable to load astrology videos.');
    }

    final decoded = jsonDecode(response.body);

    final root = decoded is Map
        ? Map<String, dynamic>.from(decoded)
        : <String, dynamic>{};

    final rawData = root['data'] ?? root;

    final rawList = rawData is List
        ? rawData
        : rawData is Map
        ? rawData['videos'] ?? rawData['items'] ?? const []
        : const [];

    if (rawList is! List) return const [];

    return rawList
        .whereType<Map>()
        .map((item) => AstrologyVideo.fromJson(Map<String, dynamic>.from(item)))
        .where(
          (video) => video.id.isNotEmpty && video.youtubeVideoId.isNotEmpty,
        )
        .toList(growable: false);
  }

  void close() => _client.close();
}
