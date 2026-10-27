import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

const consultationKundliV1Enabled = bool.fromEnvironment(
  'KUNDLI_CONSENT_V1_ENABLED',
  defaultValue: false,
);
const kundliConsentPolicyVersion = 'kundli-local-v1';

class ConsultationKundliException implements Exception {
  const ConsultationKundliException(this.message);
  final String message;
}

class ConsultationKundliApi {
  ConsultationKundliApi({
    http.Client? client,
    AuthSessionStore? sessions,
    this.enabled = consultationKundliV1Enabled,
  }) : _client = client ?? http.Client(),
       _sessions = sessions ?? AuthSessionStore();
  final http.Client _client;
  final AuthSessionStore _sessions;
  final bool enabled;
  String? _boundUserId;
  final int _sessionRevision = AuthSessionStore.sessionRevision;
  bool _closed = false;

  static String newRequestKey() {
    final random = Random.secure();
    final bytes = List.generate(16, (_) => random.nextInt(256));
    bytes[6] = (bytes[6] & 15) | 64;
    bytes[8] = (bytes[8] & 63) | 128;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  Future<Map<String, dynamic>> status(String id) =>
      _request(id, 'consent', 'GET');
  Future<Map<String, dynamic>> grant(String id) => _request(
    id,
    'consent',
    'POST',
    {'accepted': true, 'policyVersion': kundliConsentPolicyVersion},
  );
  Future<Map<String, dynamic>> revoke(String id) =>
      _request(id, 'consent', 'DELETE');
  Future<Map<String, dynamic>> generate(String id, String key) =>
      _request(id, 'generate', 'POST', {'requestKey': key, 'lang': 'en'});

  Future<Map<String, dynamic>> _request(
    String id,
    String action,
    String method, [
    Map<String, dynamic>? body,
  ]) async {
    if (!enabled ||
        _closed ||
        _sessionRevision != AuthSessionStore.sessionRevision) {
      throw const ConsultationKundliException(
        'Consultation Kundli is not activated.',
      );
    }
    final session = await _sessions.read();
    if (_closed || _sessionRevision != AuthSessionStore.sessionRevision) {
      throw const ConsultationKundliException('Open this consultation again.');
    }
    final token = session?.accessToken.trim() ?? '';
    final userId = session?.user['id'];
    if (token.isEmpty || userId is! String || userId.isEmpty) {
      throw const ConsultationKundliException('Please sign in again.');
    }
    // A screen/API instance belongs to its opening account. Do not send a
    // delayed dialog action using a different account's freshly read token.
    if (_boundUserId != null && _boundUserId != userId) {
      throw const ConsultationKundliException(
        'Account changed. Open this consultation again.',
      );
    }
    _boundUserId = userId;
    try {
      final request = http.Request(
        method,
        Uri.parse(
          '${ApiConfig.baseUrl}/kundli/v1/consultations/${Uri.encodeComponent(id)}/$action',
        ),
      );
      request.headers.addAll({
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      });
      if (body != null) request.body = jsonEncode(body);
      final response = await http.Response.fromStream(
        await _client.send(request).timeout(ApiConfig.requestTimeout),
      ).timeout(ApiConfig.requestTimeout);
      final current = await _sessions.read();
      if (_closed ||
          _sessionRevision != AuthSessionStore.sessionRevision ||
          current?.user['id'] != userId) {
        throw const ConsultationKundliException(
          'Account changed. Open this consultation again.',
        );
      }
      if (response.statusCode == 401 || response.statusCode == 403) {
        throw const ConsultationKundliException(
          'Access denied or authorization expired. Refresh your session and consent.',
        );
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map ||
          response.statusCode < 200 ||
          response.statusCode >= 300 ||
          decoded['success'] != true ||
          decoded['data'] is! Map) {
        throw ConsultationKundliException(
          decoded is Map && decoded['message'] is String
              ? decoded['message'] as String
              : 'Unable to complete the Kundli request.',
        );
      }
      return Map<String, dynamic>.from(decoded['data'] as Map);
    } on ConsultationKundliException {
      rethrow;
    } catch (_) {
      throw const ConsultationKundliException(
        'Kundli service is unavailable. No success has been confirmed.',
      );
    }
  }

  void close() {
    _closed = true;
    _client.close();
  }
}
