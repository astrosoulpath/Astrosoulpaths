import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:mime/mime.dart';

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class MarketplaceSellerApi {
  MarketplaceSellerApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<Map<String, dynamic>?> getProfile() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/profile',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace seller profile.',
    );

    return _dataMap(body);
  }

  Future<Map<String, dynamic>> saveProfile({
    String? shopDisplayName,
    String? shopBio,
  }) async {
    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/seller/profile',
      authenticated: true,
      body: <String, dynamic>{
        'shopDisplayName': shopDisplayName ?? '',
        'shopBio': shopBio ?? '',
      },
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to save marketplace seller profile.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getProducts() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/products',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace products.',
    );

    return _dataList(body);
  }

  Future<List<Map<String, dynamic>>> getCategories() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/categories',
      authenticated: false,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace categories.',
    );

    return _dataList(body);
  }

  Future<Map<String, dynamic>> createProduct({
    required String categoryId,
    required String name,
    required String sku,
    required double mrp,
    required double sellingPrice,
    required int stock,
    String? shortDescription,
    String? description,
    int? lowStockThreshold,
    double? shippingCharge,
    int? weightGrams,
  }) async {
    final payload = <String, dynamic>{
      'categoryId': categoryId,
      'name': name,
      'sku': sku,
      'mrp': mrp,
      'sellingPrice': sellingPrice,
      'stock': stock,
    };

    if (shortDescription != null) {
      payload['shortDescription'] = shortDescription;
    }

    if (description != null) {
      payload['description'] = description;
    }

    if (lowStockThreshold != null) {
      payload['lowStockThreshold'] = lowStockThreshold;
    }

    if (shippingCharge != null) {
      payload['shippingCharge'] = shippingCharge;
    }

    if (weightGrams != null) {
      payload['weightGrams'] = weightGrams;
    }

    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/seller/products',
      authenticated: true,
      body: payload,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to create marketplace product.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateProduct({
    required String productId,
    required Map<String, dynamic> changes,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/products/$productId',
      authenticated: true,
      body: changes,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to update marketplace product.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> uploadProductImage({
    required String productId,
    required String filePath,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const MarketplaceSellerApiException(
        'Your login session is missing. Please login again.',
        loginRequired: true,
      );
    }

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/marketplace/seller/products/$productId/images',
    );

    final mimeType = lookupMimeType(filePath) ?? 'application/octet-stream';

    final mimeParts = mimeType.split('/');

    if (mimeParts.length != 2 || mimeParts.first != 'image') {
      throw const MarketplaceSellerApiException(
        'Please select a valid JPG, PNG or WEBP image.',
      );
    }

    if (mimeType != 'image/jpeg' &&
        mimeType != 'image/png' &&
        mimeType != 'image/webp') {
      throw const MarketplaceSellerApiException(
        'Only JPG, PNG and WEBP images are supported.',
      );
    }

    final request = http.MultipartRequest('POST', uri);

    request.headers['Accept'] = 'application/json';
    request.headers['Authorization'] = 'Bearer $accessToken';

    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        filePath,
        contentType: MediaType(mimeParts[0], mimeParts[1]),
      ),
    );

    try {
      final streamedResponse = await request.send().timeout(
        ApiConfig.requestTimeout,
      );

      final response = await http.Response.fromStream(streamedResponse);

      final body = _decode(response.body);

      _ensureSuccess(
        response,
        body,
        fallback: 'Unable to upload product image.',
      );

      return _dataMap(body) ?? <String, dynamic>{};
    } on MarketplaceSellerApiException {
      rethrow;
    } catch (_) {
      throw const MarketplaceSellerApiException(
        'Unable to upload product image. Please check your connection.',
      );
    }
  }

  Future<Map<String, dynamic>> submitProduct({
    required String productId,
  }) async {
    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/seller/products/$productId/submit',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to submit product for review.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> archiveProduct({
    required String productId,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/products/$productId/archive',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to archive marketplace product.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getOrders() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/orders',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace seller orders.',
    );

    return _dataList(body);
  }

  Future<Map<String, dynamic>> getOrder({required String sellerOrderId}) async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/orders/$sellerOrderId',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace seller order.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> acceptOrder({
    required String sellerOrderId,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/orders/$sellerOrderId/accept',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to accept marketplace order.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> processOrder({
    required String sellerOrderId,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/orders/$sellerOrderId/process',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to move marketplace order to processing.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> shipOrder({
    required String sellerOrderId,
    required String trackingCarrier,
    required String trackingNumber,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/orders/$sellerOrderId/ship',
      authenticated: true,
      body: <String, dynamic>{
        'trackingCarrier': trackingCarrier.trim(),
        'trackingNumber': trackingNumber.trim(),
      },
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to mark marketplace order as shipped.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> deliverOrder({
    required String sellerOrderId,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/seller/orders/$sellerOrderId/deliver',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to mark marketplace order as delivered.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<Map<String, dynamic>> requestPayout() async {
    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/seller/payouts/request',
      authenticated: true,
    );

    dynamic body;

    if (response.body.trim().isNotEmpty) {
      try {
        body = jsonDecode(response.body);
      } catch (_) {
        body = null;
      }
    }

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to request marketplace payout',
    );

    if (body is Map<String, dynamic>) {
      final data = body['data'];

      if (data is Map<String, dynamic>) {
        return data;
      }

      return body;
    }

    if (body is Map) {
      final normalized = Map<String, dynamic>.from(body);

      final data = normalized['data'];

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return normalized;
    }

    return <String, dynamic>{};
  }

  Future<http.Response> _request({
    required String method,
    required String endpoint,
    required bool authenticated,
    Map<String, dynamic>? body,
  }) async {
    final headers = <String, String>{'Accept': 'application/json'};

    if (body != null) {
      headers['Content-Type'] = 'application/json';
    }

    if (authenticated) {
      final session = await _sessionStore.read();
      final accessToken = session?.accessToken.trim() ?? '';

      if (accessToken.isEmpty) {
        throw const MarketplaceSellerApiException(
          'Your login session is missing. Please login again.',
          loginRequired: true,
        );
      }

      headers['Authorization'] = 'Bearer $accessToken';
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');

    try {
      switch (method) {
        case 'GET':
          return await _client
              .get(uri, headers: headers)
              .timeout(ApiConfig.requestTimeout);

        case 'POST':
          return await _client
              .post(
                uri,
                headers: headers,
                body: body == null ? null : jsonEncode(body),
              )
              .timeout(ApiConfig.requestTimeout);

        case 'PATCH':
          return await _client
              .patch(
                uri,
                headers: headers,
                body: body == null ? null : jsonEncode(body),
              )
              .timeout(ApiConfig.requestTimeout);

        default:
          throw const MarketplaceSellerApiException(
            'Unsupported marketplace request.',
          );
      }
    } on MarketplaceSellerApiException {
      rethrow;
    } catch (_) {
      throw const MarketplaceSellerApiException(
        'Unable to connect to marketplace service.',
      );
    }
  }

  dynamic _decode(String source) {
    if (source.trim().isEmpty) {
      return null;
    }

    try {
      return jsonDecode(source);
    } catch (_) {
      return null;
    }
  }

  Map<String, dynamic>? _dataMap(dynamic body) {
    if (body is! Map) {
      return null;
    }

    final data = body['data'];

    if (data == null) {
      return null;
    }

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }

    return null;
  }

  List<Map<String, dynamic>> _dataList(dynamic body) {
    dynamic source = body;

    if (body is Map) {
      source = body['data'];
    }

    if (source is! List) {
      return const <Map<String, dynamic>>[];
    }

    return source
        .whereType<Map>()
        .map(
          (item) => item.map((key, value) => MapEntry(key.toString(), value)),
        )
        .toList(growable: false);
  }

  void _ensureSuccess(
    http.Response response,
    dynamic body, {
    required String fallback,
  }) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }

    if (response.statusCode == 401) {
      throw MarketplaceSellerApiException(
        _message(body, 'Your session has expired. Please login again.'),
        loginRequired: true,
      );
    }

    throw MarketplaceSellerApiException(_message(body, fallback));
  }

  String _message(dynamic body, String fallback) {
    if (body is Map) {
      final message = body['message'];

      if (message is String && message.trim().isNotEmpty) {
        return message.trim();
      }

      if (message is List && message.isNotEmpty) {
        return message.map((item) => item.toString()).join(', ');
      }

      final error = body['error'];

      if (error is String && error.trim().isNotEmpty) {
        return error.trim();
      }
    }

    return fallback;
  }

  Future<Map<String, dynamic>> getEarnings() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/earnings',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace earnings.',
    );

    return _dataMap(body) ?? <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getPayouts() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/seller/payouts',
      authenticated: true,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace payout history.',
    );

    return _dataList(body);
  }

  void dispose() {
    _client.close();
  }
}

class MarketplaceSellerApiException implements Exception {
  const MarketplaceSellerApiException(
    this.message, {
    this.loginRequired = false,
  });

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}
