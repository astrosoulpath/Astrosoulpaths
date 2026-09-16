import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';

class MarketplacePublicApiException implements Exception {
  const MarketplacePublicApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class MarketplacePublicApi {
  MarketplacePublicApi({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  Future<List<Map<String, dynamic>>> getCategories() async {
    final body = await _get(
      '/marketplace/categories',
      const <String, String>{},
    );

    return _extractList(body);
  }

  Future<List<Map<String, dynamic>>> getProducts({
    String? search,
    String? categoryId,
    bool featuredOnly = false,
  }) async {
    final query = <String, String>{};

    final normalizedSearch = search?.trim() ?? '';
    final normalizedCategoryId = categoryId?.trim() ?? '';

    if (normalizedSearch.isNotEmpty) {
      query['search'] = normalizedSearch;
    }

    if (normalizedCategoryId.isNotEmpty) {
      query['categoryId'] = normalizedCategoryId;
    }

    // Important:
    // Do not send featured=false because backend treats a supplied
    // featured query as an explicit boolean filter.
    if (featuredOnly) {
      query['featured'] = 'true';
    }

    final body = await _get('/marketplace/products', query);

    return _extractList(body);
  }

  Future<Map<String, dynamic>> getProduct(String id) async {
    final normalizedId = id.trim();

    if (normalizedId.isEmpty) {
      throw const MarketplacePublicApiException(
        'Marketplace product ID is required.',
      );
    }

    final body = await _get(
      '/marketplace/products/$normalizedId',
      const <String, String>{},
    );

    final data = body['data'];

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    throw const MarketplacePublicApiException(
      'Invalid marketplace product response.',
    );
  }

  Future<List<Map<String, dynamic>>> getCampaigns() async {
    final body = await _get('/marketplace/campaigns', const <String, String>{});

    return _extractList(body);
  }

  Future<Map<String, dynamic>> _get(
    String endpoint,
    Map<String, String> query,
  ) async {
    var uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');

    if (query.isNotEmpty) {
      uri = uri.replace(queryParameters: query);
    }

    try {
      final response = await _client
          .get(
            uri,
            headers: const <String, String>{'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      dynamic decoded;

      if (response.body.trim().isNotEmpty) {
        decoded = jsonDecode(response.body);
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        String message = 'Marketplace request failed.';

        if (decoded is Map) {
          final apiMessage = decoded['message'];

          if (apiMessage is String && apiMessage.trim().isNotEmpty) {
            message = apiMessage.trim();
          }
        }

        throw MarketplacePublicApiException(message);
      }

      if (decoded is! Map) {
        throw const MarketplacePublicApiException(
          'Invalid marketplace response.',
        );
      }

      return Map<String, dynamic>.from(decoded);
    } on MarketplacePublicApiException {
      rethrow;
    } on FormatException {
      throw const MarketplacePublicApiException(
        'Marketplace returned invalid data.',
      );
    } catch (_) {
      throw const MarketplacePublicApiException(
        'Unable to connect to marketplace.',
      );
    }
  }

  List<Map<String, dynamic>> _extractList(Map<String, dynamic> body) {
    final data = body['data'];

    if (data == null) {
      return <Map<String, dynamic>>[];
    }

    if (data is! List) {
      throw const MarketplacePublicApiException(
        'Invalid marketplace list response.',
      );
    }

    return data
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  void dispose() {
    _client.close();
  }
}
