import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'customer_wallet.dart';
import 'recharge_pack.dart';

class WalletApiException implements Exception {
  const WalletApiException(this.message, {this.loginRequired = false});

  final String message;
  final bool loginRequired;

  @override
  String toString() => message;
}

class WalletApi {
  WalletApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<CustomerWallet> getWallet() async {
    final session = await _sessionStore.read();
    var accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to access your wallet.',
        loginRequired: true,
      );
    }

    try {
      var response = await _getWalletResponse(accessToken);

      // Access JWT may expire between session read and API request.
      // Refresh the SAME authenticated session and retry exactly once.
      if (response.statusCode == 401 || response.statusCode == 403) {
        final refreshedSession = await _sessionStore.forceRefresh();
        final refreshedToken = refreshedSession?.accessToken.trim() ?? '';

        if (refreshedToken.isEmpty) {
          throw const WalletApiException(
            'Your session has expired. Please login again.',
            loginRequired: true,
          );
        }

        accessToken = refreshedToken;
        response = await _getWalletResponse(accessToken);
      }

      final body = _decodeBody(response.body);

      // A second authentication rejection means the backend has genuinely
      // rejected the refreshed/current session.
      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw WalletApiException(
          _readMessage(body, fallback: 'Failed to load wallet.'),
        );
      }

      final data = body['data'];

      if (data is! Map) {
        throw const WalletApiException(
          'The server returned an invalid wallet response.',
        );
      }

      return CustomerWallet.fromJson(Map<String, dynamic>.from(data));
    } on WalletApiException {
      rethrow;
    } catch (_) {
      // Network/timeout/temporary backend failures are NOT logout events.
      throw const WalletApiException(
        'Unable to connect to the server. Please try again.',
      );
    }
  }

  Future<http.Response> _authenticatedWalletRequest(
    Future<http.Response> Function(String token) request,
  ) async {
    final session = await _sessionStore.read();
    var token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const WalletApiException(
        'Please login to continue.',
        loginRequired: true,
      );
    }

    var response = await request(token);

    if (response.statusCode == 401 || response.statusCode == 403) {
      final refreshedSession = await _sessionStore.forceRefresh();
      final refreshedToken = refreshedSession?.accessToken.trim() ?? '';

      if (refreshedToken.isEmpty) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      token = refreshedToken;
      response = await request(token);
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      throw const WalletApiException(
        'Your session has expired. Please login again.',
        loginRequired: true,
      );
    }

    return response;
  }

  Future<http.Response> _getWalletResponse(String accessToken) {
    return _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}/wallet'),
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer $accessToken',
          },
        )
        .timeout(ApiConfig.requestTimeout);
  }

  Future<List<RechargePack>> getRechargePacks() async {
    try {
      final response = await _authenticatedWalletRequest(
        (token) => _client
            .get(
              Uri.parse('${ApiConfig.baseUrl}/wallet/recharge-packs'),
              headers: {
                'Accept': 'application/json',
                'Authorization': 'Bearer $token',
              },
            )
            .timeout(ApiConfig.requestTimeout),
      );

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw WalletApiException(
          _readMessage(body, fallback: 'Unable to load recharge packs.'),
        );
      }

      final data = body['data'];

      if (data is! List) {
        throw const WalletApiException(
          'The server returned an invalid recharge pack response.',
        );
      }

      return data
          .whereType<Map>()
          .map((item) => RechargePack.fromJson(Map<String, dynamic>.from(item)))
          .where((pack) => pack.id.isNotEmpty)
          .toList(growable: false);
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException('Unable to connect to recharge service.');
    }
  }

  Future<Map<String, dynamic>> createRechargeOrder(double amount) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to recharge your wallet.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse(
              '${ApiConfig.baseUrl}/payments/create-wallet-recharge-order',
            ),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({'amount': amount}),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw WalletApiException(
          _readMessage(
            body,
            fallback: 'Unable to create wallet recharge order.',
          ),
        );
      }

      if (body.isEmpty) {
        throw const WalletApiException(
          'The server returned an empty payment order.',
        );
      }

      return body;
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException('Unable to connect to payment service.');
    }
  }

  Future<String> getRazorpayPublicKeyId() async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to continue payment.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/payments/razorpay-public-config'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw WalletApiException(
          _readMessage(
            body,
            fallback: 'Unable to load secure payment configuration.',
          ),
        );
      }

      final data = body['data'];

      if (data is! Map) {
        throw const WalletApiException(
          'Invalid payment configuration response.',
        );
      }

      final keyId = data['keyId']?.toString().trim() ?? '';

      if (keyId.isEmpty) {
        throw const WalletApiException('Payment configuration is unavailable.');
      }

      return keyId;
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException(
        'Unable to connect to payment configuration service.',
      );
    }
  }

  Future<Map<String, dynamic>> createRechargePackOrder(String packId) async {
    final normalizedPackId = packId.trim();

    if (normalizedPackId.isEmpty) {
      throw const WalletApiException('Please select a valid recharge pack.');
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to recharge your wallet.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse(
              '${ApiConfig.baseUrl}/payments/create-wallet-recharge-pack-order',
            ),
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
            body: jsonEncode({'packId': normalizedPackId}),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw WalletApiException(
          _readMessage(
            body,
            fallback: 'Unable to create recharge payment order.',
          ),
        );
      }

      if (body.isEmpty) {
        throw const WalletApiException(
          'The server returned an empty payment order.',
        );
      }

      return body;
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException('Unable to connect to payment service.');
    }
  }

  Future<Map<String, dynamic>> reconcileOrder(String razorpayOrderId) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to verify your payment.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .post(
            Uri.parse(
              '${ApiConfig.baseUrl}/payments/reconcile/$razorpayOrderId',
            ),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw WalletApiException(
          _readMessage(body, fallback: 'Unable to verify wallet recharge.'),
        );
      }

      return body;
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException(
        'Unable to verify payment with the server.',
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
