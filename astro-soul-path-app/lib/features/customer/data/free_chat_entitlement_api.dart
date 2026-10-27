import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

class FreeChatEntitlement {
  const FreeChatEntitlement({
    required this.userId,
    required this.revision,
    required this.eligible,
    required this.used,
    required this.minutes,
    required this.canPresent,
  });
  final String userId;
  final int revision;
  final bool eligible, used;
  final bool canPresent;
  final int minutes;
}

/// Fetches existing read-only session state; never grants or consumes a benefit.
class FreeChatEntitlementApi {
  FreeChatEntitlementApi({http.Client? client, AuthSessionStore? sessions})
    : _client = client ?? http.Client(),
      _sessions = sessions ?? AuthSessionStore();
  final http.Client _client;
  final AuthSessionStore _sessions;
  bool _closed = false;
  Future<FreeChatEntitlement?> fetch() async {
    final revision = AuthSessionStore.sessionRevision;
    final session = await _sessions.read();
    final owner = session?.user['id'];
    if (_closed ||
        owner is! String ||
        owner.isEmpty ||
        session?.portal != 'customer' ||
        session?.role != 'CUSTOMER') {
      return null;
    }
    final response = await _client
        .get(
          Uri.parse('${ApiConfig.baseUrl}/user/session?portal=customer'),
          headers: {
            'Authorization': 'Bearer ${session!.accessToken}',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        )
        .timeout(ApiConfig.requestTimeout);
    final after = await _sessions.read();
    if (_closed ||
        revision != AuthSessionStore.sessionRevision ||
        after?.user['id'] != owner ||
        after?.portal != 'customer' ||
        after?.role != 'CUSTOMER') {
      return null;
    }
    if (response.statusCode != 200) {
      throw StateError('Unable to verify Free Chat eligibility');
    }
    final body = jsonDecode(response.body);
    if (body is! Map ||
        body['success'] != true ||
        body['role'] != 'CUSTOMER' ||
        body['portal'] != 'customer' ||
        body['user'] is! Map ||
        body['user']['id'] != owner ||
        body['user']['freeChat'] is! Map) {
      return null;
    }
    final free = body['user']['freeChat'] as Map;
    final minutes = free['minutes'];
    if (minutes is! int ||
        minutes < 0 ||
        free['used'] is! bool ||
        free['eligible'] is! bool) {
      return null;
    }
    return FreeChatEntitlement(
      userId: owner,
      revision: revision,
      eligible:
          free['eligible'] == true && free['used'] == false && minutes > 0,
      used: free['used'] == true,
      minutes: minutes,
      canPresent: free['showPopup'] == true,
    );
  }

  void close() {
    _closed = true;
    _client.close();
  }
}
