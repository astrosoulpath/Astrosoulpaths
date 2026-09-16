import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'wallet_api.dart';
import 'wallet_transaction.dart';

class WalletHistoryApi {
  WalletHistoryApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<List<WalletTransaction>> getHistory() async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const WalletApiException(
        'Please login to access wallet history.',
        loginRequired: true,
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/wallet/history'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401) {
        throw const WalletApiException(
          'Your session has expired. Please login again.',
          loginRequired: true,
        );
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw WalletApiException(
          _readMessage(body, fallback: 'Failed to load wallet history.'),
        );
      }

      final data = body['data'];

      if (data is! Map) {
        throw const WalletApiException(
          'The server returned invalid wallet history.',
        );
      }

      final transactions = data['transactions'];

      if (transactions is! List) {
        throw const WalletApiException(
          'The server returned invalid wallet transactions.',
        );
      }

      return transactions
          .whereType<Map>()
          .map(
            (item) =>
                WalletTransaction.fromJson(Map<String, dynamic>.from(item)),
          )
          .where((item) => item.id.isNotEmpty)
          .toList(growable: false);
    } on WalletApiException {
      rethrow;
    } catch (_) {
      throw const WalletApiException(
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

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // The caller returns a safe user-facing error.
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
