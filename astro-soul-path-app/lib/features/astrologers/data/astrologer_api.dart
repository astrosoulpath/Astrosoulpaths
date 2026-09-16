import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'public_astrologer.dart';

class AstrologerApiException implements Exception {
  const AstrologerApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AstrologerApi {
  AstrologerApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<PublicAstrologersResult> getPublicAstrologers({
    String? search,
    String? language,
    String? expertise,
    String? category,
    bool? online,
  }) async {
    final query = <String, String>{};

    if (search != null && search.trim().isNotEmpty) {
      query['search'] = search.trim();
    }

    if (language != null && language.trim().isNotEmpty) {
      query['language'] = language.trim();
    }

    if (expertise != null && expertise.trim().isNotEmpty) {
      query['expertise'] = expertise.trim();
    }

    if (category != null && category.trim().isNotEmpty) {
      query['category'] = category.trim();
    }

    if (online != null) {
      query['online'] = online.toString();
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/astrologer/public',
    ).replace(queryParameters: query.isEmpty ? null : query);

    try {
      final response = await _client
          .get(uri, headers: const {'Accept': 'application/json'})
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw AstrologerApiException(
          _readMessage(body, fallback: 'Failed to load astrologers.'),
        );
      }

      final rawData = body['data'];
      final astrologers = <PublicAstrologer>[];

      if (rawData is List) {
        for (final item in rawData) {
          if (item is Map) {
            final astrologer = PublicAstrologer.fromJson(
              Map<String, dynamic>.from(item),
            );

            if (astrologer.id.isNotEmpty) {
              astrologers.add(astrologer);
            }
          }
        }
      }

      final meta = body['meta'];
      final totalSource = meta is Map ? meta['total'] : astrologers.length;
      final total =
          int.tryParse(totalSource?.toString() ?? '') ?? astrologers.length;

      return PublicAstrologersResult(
        astrologers: List.unmodifiable(astrologers),
        total: total < 0 ? 0 : total,
      );
    } on AstrologerApiException {
      rethrow;
    } catch (_) {
      throw const AstrologerApiException(
        'Unable to connect to the server. Please try again.',
      );
    }
  }

  Future<PublicAstrologerProfile> getPublicAstrologerById(String id) async {
    final normalizedId = id.trim();

    if (normalizedId.isEmpty) {
      throw const AstrologerApiException('Astrologer ID is required.');
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/astrologer/public/'
      '${Uri.encodeComponent(normalizedId)}',
    );

    try {
      final response = await _client
          .get(uri, headers: const {'Accept': 'application/json'})
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw AstrologerApiException(
          _readMessage(body, fallback: 'Failed to load astrologer profile.'),
        );
      }

      final rawData = body['data'];

      if (rawData is! Map) {
        throw const AstrologerApiException(
          'The server returned an invalid astrologer profile.',
        );
      }

      final profile = PublicAstrologerProfile.fromJson(
        Map<String, dynamic>.from(rawData),
      );

      if (profile.astrologer.id.isEmpty) {
        throw const AstrologerApiException(
          'The server returned an invalid astrologer profile.',
        );
      }

      return profile;
    } on AstrologerApiException {
      rethrow;
    } catch (_) {
      throw const AstrologerApiException(
        'Unable to connect to the server. Please try again.',
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
      // The caller returns a consistent user-facing error.
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

  void close() {
    _client.close();
  }
}
