import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class MarketplaceCustomerApi {
  MarketplaceCustomerApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<Map<String, dynamic>> getCart() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/customer/cart',
    );

    final body = _decode(response.body);

    _ensureSuccess(response, body, fallback: 'Unable to load your cart.');

    return _dataMap(body);
  }

  Future<Map<String, dynamic>> addCartItem({
    required String productId,
    required int quantity,
  }) async {
    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/customer/cart/items',
      body: <String, dynamic>{'productId': productId, 'quantity': quantity},
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to add this product to your cart.',
    );

    return _dataMap(body);
  }

  Future<Map<String, dynamic>> updateCartItem({
    required String itemId,
    required int quantity,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/customer/cart/items/$itemId',
      body: <String, dynamic>{'quantity': quantity},
    );

    final body = _decode(response.body);

    _ensureSuccess(response, body, fallback: 'Unable to update cart quantity.');

    return _dataMap(body);
  }

  Future<Map<String, dynamic>> removeCartItem({required String itemId}) async {
    final response = await _request(
      method: 'DELETE',
      endpoint: '/marketplace/customer/cart/items/$itemId',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to remove this item from your cart.',
    );

    return _dataMap(body);
  }

  Future<List<Map<String, dynamic>>> getAddresses() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/customer/addresses',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load your delivery addresses.',
    );

    return _dataList(body);
  }

  Future<List<Map<String, dynamic>>> createAddress({
    required String fullName,
    required String phone,
    required String addressLine1,
    String? addressLine2,
    String? landmark,
    required String city,
    required String state,
    required String postalCode,
    required String country,
    String? countryCode,
    bool isDefault = false,
  }) async {
    final payload = <String, dynamic>{
      'fullName': fullName.trim(),
      'phone': phone.trim(),
      'addressLine1': addressLine1.trim(),
      'city': city.trim(),
      'state': state.trim(),
      'postalCode': postalCode.trim(),
      'country': country.trim(),
      'isDefault': isDefault,
    };

    _putOptional(payload, 'addressLine2', addressLine2);
    _putOptional(payload, 'landmark', landmark);
    _putOptional(payload, 'countryCode', countryCode);

    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/customer/addresses',
      body: payload,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to save delivery address.',
    );

    return _dataList(body);
  }

  Future<List<Map<String, dynamic>>> updateAddress({
    required String addressId,
    required Map<String, dynamic> changes,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/customer/addresses/$addressId',
      body: changes,
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to update delivery address.',
    );

    return _dataList(body);
  }

  Future<List<Map<String, dynamic>>> setDefaultAddress({
    required String addressId,
  }) async {
    final response = await _request(
      method: 'PATCH',
      endpoint: '/marketplace/customer/addresses/$addressId/default',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to set default delivery address.',
    );

    return _dataList(body);
  }

  Future<List<Map<String, dynamic>>> deleteAddress({
    required String addressId,
  }) async {
    final response = await _request(
      method: 'DELETE',
      endpoint: '/marketplace/customer/addresses/$addressId',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to delete delivery address.',
    );

    return _dataList(body);
  }

  Future<Map<String, dynamic>> prepareOrder({
    required String addressId,
    required String idempotencyKey,
  }) async {
    final response = await _request(
      method: 'POST',
      endpoint: '/marketplace/customer/orders/prepare',
      body: {
        'addressId': addressId.trim(),
        'idempotencyKey': idempotencyKey.trim(),
      },
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to prepare your marketplace order.',
    );

    return _dataMap(body);
  }

  Future<Map<String, dynamic>> createRazorpayOrder({
    required String orderId,
  }) async {
    final normalizedOrderId = orderId.trim();

    if (normalizedOrderId.isEmpty) {
      throw const MarketplaceCustomerApiException(
        'Marketplace order id is missing.',
      );
    }

    final response = await _request(
      method: 'POST',
      endpoint:
          '/marketplace/customer/orders/$normalizedOrderId/payment/razorpay',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to start Razorpay payment.',
    );

    final data = _dataMap(body);

    final marketplaceOrderId =
        data['marketplaceOrderId']?.toString().trim() ?? '';
    final razorpayOrderId = data['razorpayOrderId']?.toString().trim() ?? '';
    final currency = data['currency']?.toString().trim().toUpperCase() ?? '';

    final rawAmountSubunits =
        data['amountSubunits'] ?? data['razorpayAmountSubunits'];

    final amountSubunits = rawAmountSubunits is num
        ? rawAmountSubunits.toDouble()
        : double.tryParse(rawAmountSubunits?.toString() ?? '');

    if (marketplaceOrderId.isEmpty ||
        razorpayOrderId.isEmpty ||
        currency.isEmpty ||
        amountSubunits == null ||
        !amountSubunits.isFinite ||
        amountSubunits <= 0 ||
        amountSubunits.roundToDouble() != amountSubunits) {
      throw const MarketplaceCustomerApiException(
        'Marketplace Razorpay order response is invalid.',
      );
    }

    /*
     * Normalize the provider amount to an integer so checkout never
     * recalculates currency subunits on the device.
     */
    data['amountSubunits'] = amountSubunits.toInt();

    return data;
  }

  Future<Map<String, dynamic>> verifyRazorpayPayment({
    required String orderId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final normalizedOrderId = orderId.trim();
    final normalizedRazorpayOrderId = razorpayOrderId.trim();
    final normalizedPaymentId = razorpayPaymentId.trim();
    final normalizedSignature = razorpaySignature.trim();

    if (normalizedOrderId.isEmpty ||
        normalizedRazorpayOrderId.isEmpty ||
        normalizedPaymentId.isEmpty ||
        normalizedSignature.isEmpty) {
      throw const MarketplaceCustomerApiException(
        'Razorpay payment verification data is incomplete.',
      );
    }

    final response = await _request(
      method: 'POST',
      endpoint:
          '/marketplace/customer/orders/$normalizedOrderId/payment/verify',
      body: <String, dynamic>{
        'razorpayOrderId': normalizedRazorpayOrderId,
        'razorpayPaymentId': normalizedPaymentId,
        'razorpaySignature': normalizedSignature,
      },
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to verify Razorpay payment.',
    );

    final data = _dataMap(body);

    if (data['orderConfirmed'] != true || data['signatureVerified'] != true) {
      throw const MarketplaceCustomerApiException(
        'Marketplace payment verification was not confirmed.',
      );
    }

    return data;
  }

  Future<List<Map<String, dynamic>>> getOrders() async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/customer/orders',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace orders.',
    );

    final rawData = body['data'];

    if (rawData is! List) {
      return const <Map<String, dynamic>>[];
    }

    return rawData
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  Future<Map<String, dynamic>> getOrder({required String orderId}) async {
    final response = await _request(
      method: 'GET',
      endpoint: '/marketplace/customer/orders/$orderId',
    );

    final body = _decode(response.body);

    _ensureSuccess(
      response,
      body,
      fallback: 'Unable to load marketplace order.',
    );

    final rawData = body['data'];

    if (rawData is! Map) {
      throw const MarketplaceCustomerApiException(
        'Marketplace order response is invalid',
      );
    }

    return Map<String, dynamic>.from(rawData);
  }

  Future<http.Response> _request({
    required String method,
    required String endpoint,
    Map<String, dynamic>? body,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const MarketplaceCustomerApiException(
        'Your login session is missing. Please login again.',
        loginRequired: true,
      );
    }

    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };

    if (body != null) {
      headers['Content-Type'] = 'application/json';
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

        case 'DELETE':
          return await _client
              .delete(uri, headers: headers)
              .timeout(ApiConfig.requestTimeout);

        default:
          throw const MarketplaceCustomerApiException(
            'Unsupported marketplace request.',
          );
      }
    } on MarketplaceCustomerApiException {
      rethrow;
    } catch (_) {
      throw const MarketplaceCustomerApiException(
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

  Map<String, dynamic> _dataMap(dynamic body) {
    if (body is! Map) {
      return <String, dynamic>{};
    }

    final data = body['data'];

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return data.map((key, value) => MapEntry(key.toString(), value));
    }

    return <String, dynamic>{};
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
      throw MarketplaceCustomerApiException(
        _message(body, 'Your session has expired. Please login again.'),
        loginRequired: true,
      );
    }

    throw MarketplaceCustomerApiException(_message(body, fallback));
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

  void _putOptional(Map<String, dynamic> target, String key, String? value) {
    final normalized = value?.trim() ?? '';

    if (normalized.isNotEmpty) {
      target[key] = normalized;
    }
  }

  void dispose() {
    _client.close();
  }
}

class MarketplaceCustomerApiException implements Exception {
  const MarketplaceCustomerApiException(
    this.message, {
    this.loginRequired = false,
  });

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}
