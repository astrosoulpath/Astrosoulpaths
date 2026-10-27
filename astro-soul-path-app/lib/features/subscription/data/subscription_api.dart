import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import '../models/subscription_plan.dart';

class SubscriptionApiException implements Exception {
  const SubscriptionApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class SubscriptionApi {
  SubscriptionApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;
  final int _revision = AuthSessionStore.sessionRevision;
  bool _closed = false;
  Future<StoredAuthSession> _ownedSession() async {
    final session = await _sessionStore.read();
    if (_closed ||
        _revision != AuthSessionStore.sessionRevision ||
        session == null ||
        session.accessToken.trim().isEmpty ||
        !['customer', 'astrologer'].contains(session.portal) ||
        session.user['id'] is! String ||
        (session.user['id'] as String).isEmpty) {
      throw const SubscriptionApiException(
        'Your account changed or expired. Reopen subscriptions.',
        loginRequired: true,
      );
    }
    return session;
  }

  Future<void> _unchanged(StoredAuthSession original) async {
    final current = await _ownedSession();
    if (current.user['id'] != original.user['id'] ||
        current.portal != original.portal) {
      throw const SubscriptionApiException(
        'Account changed. Reopen subscriptions.',
      );
    }
  }

  Future<List<SubscriptionPlan>> getPlans() async {
    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/subscription/plans'),
            headers: const {'Accept': 'application/json'},
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SubscriptionApiException(
          'Unable to load subscription plans '
          '(HTTP ${response.statusCode}).',
        );
      }

      final decoded = jsonDecode(response.body);

      final List<dynamic> rawPlans;

      if (decoded is List) {
        rawPlans = decoded;
      } else if (decoded is Map<String, dynamic> && decoded['data'] is List) {
        rawPlans = decoded['data'] as List<dynamic>;
      } else {
        throw const SubscriptionApiException(
          'Invalid subscription response from server.',
        );
      }

      return rawPlans
          .whereType<Map<String, dynamic>>()
          .map(SubscriptionPlan.fromJson)
          .where((plan) => plan.isActive)
          .toList();
    } on SubscriptionApiException {
      rethrow;
    } catch (_) {
      throw const SubscriptionApiException(
        'Unable to connect to subscription service.',
      );
    }
  }

  Future<Map<String, dynamic>> createSubscriptionOrder(String planName) async {
    final session = await _ownedSession();
    final accessToken = session.accessToken.trim();

    if (accessToken.isEmpty) {
      throw const SubscriptionApiException(
        'Please login to subscribe.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse(
              '${ApiConfig.baseUrl}/payments/create-subscription-order',
            ),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({'planName': planName}),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);
      await _unchanged(session);

      if (response.statusCode == 401) {
        throw const SubscriptionApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SubscriptionApiException(
          _readMessage(
            body,
            fallback: 'Unable to create subscription payment order.',
          ),
        );
      }

      if (body.isEmpty) {
        throw const SubscriptionApiException(
          'The server returned an empty payment order.',
        );
      }

      return body;
    } on SubscriptionApiException {
      rethrow;
    } catch (_) {
      throw const SubscriptionApiException(
        'Unable to connect to payment service.',
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

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // Caller returns a consistent user-facing error.
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

  Future<Map<String, dynamic>> verifyCheckout({
    required String expectedOrderId,
    required String? callbackOrderId,
    required String? paymentId,
    required String? signature,
  }) async {
    if (!RegExp(r'^order_[A-Za-z0-9]+$').hasMatch(expectedOrderId) ||
        callbackOrderId != expectedOrderId ||
        !RegExp(r'^pay_[A-Za-z0-9]+$').hasMatch(paymentId ?? '') ||
        !RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(signature ?? '')) {
      throw const SubscriptionApiException(
        'Invalid checkout proof. Check payment status before retrying.',
      );
    }
    return _postVerification('verify-checkout', {
      'orderId': expectedOrderId,
      'paymentId': paymentId,
      'signature': signature,
    });
  }

  Future<Map<String, dynamic>> reconcileOrder(String razorpayOrderId) async {
    if (!RegExp(r'^order_[A-Za-z0-9]+$').hasMatch(razorpayOrderId)) {
      throw const SubscriptionApiException('Invalid payment order reference.');
    }
    return _postVerification('reconcile/$razorpayOrderId', null);
  }

  Future<Map<String, dynamic>> _postVerification(
    String path,
    Map<String, dynamic>? proof,
  ) async {
    final session = await _ownedSession();
    final accessToken = session.accessToken.trim();

    if (accessToken.isEmpty) {
      throw const SubscriptionApiException(
        'Please login to verify your payment.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/payments/$path'),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: proof == null ? null : jsonEncode(proof),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);
      await _unchanged(session);

      if (response.statusCode == 401) {
        throw const SubscriptionApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SubscriptionApiException(
          _readMessage(
            body,
            fallback: 'Unable to verify subscription payment.',
          ),
        );
      }

      return body;
    } on SubscriptionApiException {
      rethrow;
    } catch (_) {
      throw const SubscriptionApiException(
        'Unable to verify payment with the server.',
      );
    }
  }

  Future<Map<String, dynamic>?> getCurrentSubscription() async {
    final session = await _ownedSession();
    final accessToken = session.accessToken.trim();

    if (accessToken.isEmpty) {
      throw const SubscriptionApiException(
        'Please login to check your subscription.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/subscription/current'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);
      await _unchanged(session);

      if (response.statusCode == 401) {
        throw const SubscriptionApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw SubscriptionApiException(
          _readMessage(body, fallback: 'Unable to load current subscription.'),
        );
      }

      final data = body['data'];

      if (data == null) {
        return null;
      }

      if (data is Map<String, dynamic>) {
        return {...data, 'billing': body['billing']};
      }

      if (data is Map) {
        return {...Map<String, dynamic>.from(data), 'billing': body['billing']};
      }

      return null;
    } on SubscriptionApiException {
      rethrow;
    } catch (_) {
      throw const SubscriptionApiException(
        'Unable to connect to subscription service.',
      );
    }
  }

  void close() {
    _closed = true;
    _client.close();
  }

  Future<void> cancelAtPeriodEnd({String? expectedUserId}) async {
    final session = await _ownedSession();
    if (expectedUserId == null ||
        session.user['id']?.toString() != expectedUserId) {
      throw const SubscriptionApiException(
        'Account changed. Refresh your subscription before cancelling.',
      );
    }
    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/subscription/cancel'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ${session.accessToken}',
          },
          body: jsonEncode({'cancelAtPeriodEnd': true}),
        )
        .timeout(ApiConfig.requestTimeout);
    await _unchanged(session);
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        _decodeBody(response.body)['success'] != true) {
      throw const SubscriptionApiException(
        'Cancellation was not confirmed. Refresh your subscription before retrying.',
      );
    }
  }
}
