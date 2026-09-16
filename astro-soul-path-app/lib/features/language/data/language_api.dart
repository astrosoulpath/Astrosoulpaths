import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class AppLanguage {
  const AppLanguage({
    required this.code,
    required this.englishName,
    required this.nativeName,
    required this.imageUrl,
    required this.isActive,
    required this.sortOrder,
  });

  final String code;
  final String englishName;
  final String nativeName;
  final String? imageUrl;
  final bool isActive;
  final int sortOrder;

  factory AppLanguage.fromJson(Map<String, dynamic> json) {
    final rawImageUrl = json['imageUrl']?.toString().trim();

    return AppLanguage(
      code: (json['code'] ?? '').toString().trim(),
      englishName: (json['englishName'] ?? '').toString().trim(),
      nativeName: (json['nativeName'] ?? '').toString().trim(),
      imageUrl: rawImageUrl == null || rawImageUrl.isEmpty ? null : rawImageUrl,
      isActive: json['isActive'] == true,
      sortOrder: (json['sortOrder'] as num?)?.toInt() ?? 0,
    );
  }
}

class LanguageApiException implements Exception {
  const LanguageApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class LanguageApi {
  LanguageApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<AppLanguage>> getLanguages() async {
    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/languages'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      Map<String, dynamic> body = {};

      if (response.body.trim().isNotEmpty) {
        try {
          final decoded = jsonDecode(response.body);

          if (decoded is Map) {
            body = Map<String, dynamic>.from(decoded);
          }
        } catch (_) {}
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw const LanguageApiException('Failed to load languages.');
      }

      final rawData = body['data'];

      if (rawData is! List) {
        throw const LanguageApiException(
          'The server returned an invalid language response.',
        );
      }

      final languages = rawData
          .whereType<Map>()
          .map((item) => AppLanguage.fromJson(Map<String, dynamic>.from(item)))
          .where(
            (language) =>
                language.isActive &&
                language.code.isNotEmpty &&
                language.englishName.isNotEmpty,
          )
          .toList();

      languages.sort((a, b) => a.sortOrder.compareTo(b.sortOrder));

      return languages;
    } on LanguageApiException {
      rethrow;
    } catch (_) {
      throw const LanguageApiException(
        'Unable to connect to the language service.',
      );
    }
  }

  Future<Map<String, String>> getTranslations(String languageCode) async {
    final code = languageCode.trim().toLowerCase();

    if (code.isEmpty) {
      throw const LanguageApiException('Language code is required.');
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/languages/$code/translations'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      Map<String, dynamic> body = <String, dynamic>{};

      if (response.body.trim().isNotEmpty) {
        final decoded = jsonDecode(response.body);

        if (decoded is Map) {
          body = Map<String, dynamic>.from(decoded);
        }
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw const LanguageApiException('Failed to load translations.');
      }

      final rawData = body['data'];

      if (rawData is! Map) {
        throw const LanguageApiException('Invalid translation response.');
      }

      final data = Map<String, dynamic>.from(rawData);
      final rawTranslations = data['translations'];

      if (rawTranslations is! Map) {
        return <String, String>{};
      }

      return rawTranslations.map(
        (key, value) => MapEntry(key.toString(), value?.toString() ?? ''),
      );
    } on LanguageApiException {
      rethrow;
    } catch (_) {
      throw const LanguageApiException('Unable to load translations.');
    }
  }

  void close() {
    _client.close();
  }
}
