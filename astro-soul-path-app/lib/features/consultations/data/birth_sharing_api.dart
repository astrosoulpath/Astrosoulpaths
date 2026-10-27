import 'dart:convert';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

const birthSharingEnabled = bool.fromEnvironment(
  'CONSULTATION_BIRTH_SHARING_ENABLED',
  defaultValue: false,
);

class BirthSharingApi {
  BirthSharingApi({http.Client? client, AuthSessionStore? sessions})
    : _client = client ?? http.Client(),
      _sessions = sessions ?? AuthSessionStore();
  final http.Client _client;
  final AuthSessionStore _sessions;
  String? _owner;
  int? _revision;
  bool _closed = false;
  Future<bool> hasSameOwner() async {
    final current = await _sessions.read();
    return !_closed &&
        _owner != null &&
        current?.user['id'] == _owner &&
        _revision == AuthSessionStore.sessionRevision;
  }

  Future<Map<String, dynamic>> request(
    String id, {
    String action = '',
    Map<String, dynamic>? body,
  }) async {
    if (id.isEmpty ||
        id.length > 128 ||
        !['', 'grant', 'revoke'].contains(action)) {
      throw StateError('Invalid sharing request');
    }
    final revision = AuthSessionStore.sessionRevision;
    final session = await _sessions.read();
    final owner = session?.user['id'];
    if (_closed ||
        revision != AuthSessionStore.sessionRevision ||
        owner is! String ||
        owner.isEmpty ||
        session!.accessToken.isEmpty ||
        (_owner != null && (_owner != owner || _revision != revision))) {
      throw StateError('Authorization required');
    }
    _owner = owner;
    _revision = revision;
    final request = http.Request(
      action.isEmpty ? 'GET' : 'POST',
      Uri.parse(
        '${ApiConfig.baseUrl}/consultations/${Uri.encodeComponent(id)}/birth-sharing${action.isEmpty ? '' : '/$action'}',
      ).replace(
        queryParameters: action.isEmpty && body?['profileRef'] is String
            ? {'profileRef': body!['profileRef'] as String}
            : null,
      ),
    );
    request.headers.addAll({
      'Authorization': 'Bearer ${session.accessToken}',
      'Content-Type': 'application/json',
    });
    if (body != null && action.isNotEmpty) request.body = jsonEncode(body);
    final response = await http.Response.fromStream(
      await _client.send(request).timeout(ApiConfig.requestTimeout),
    ).timeout(ApiConfig.requestTimeout);
    final current = await _sessions.read();
    if (_closed ||
        revision != AuthSessionStore.sessionRevision ||
        current?.user['id'] != owner ||
        response.statusCode != 200 && response.statusCode != 201) {
      throw StateError('Birth details unavailable');
    }
    final data = jsonDecode(response.body);
    if (data is! Map<String, dynamic>) throw StateError('Invalid response');
    return data;
  }

  void close() {
    _closed = true;
    _client.close();
  }
}
