import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';

enum CustomerConsultationMode { chat, audio, video }

extension CustomerConsultationModeApi on CustomerConsultationMode {
  String get apiValue {
    switch (this) {
      case CustomerConsultationMode.chat:
        return 'chat';
      case CustomerConsultationMode.audio:
        return 'audio';
      case CustomerConsultationMode.video:
        return 'video';
    }
  }
}

class CustomerConsultationApiException implements Exception {
  const CustomerConsultationApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class CustomerConsultationResult {
  const CustomerConsultationResult({
    required this.consultationId,
    required this.status,
    required this.expiresAt,
    required this.raw,
  });

  factory CustomerConsultationResult.fromResponse(
    Map<String, dynamic> response,
  ) {
    final dataSource = response['data'];

    if (dataSource is! Map) {
      throw const CustomerConsultationApiException(
        'The server returned an invalid consultation response.',
      );
    }

    final data = Map<String, dynamic>.from(dataSource);

    final callSource = data['call'];

    if (callSource is! Map) {
      throw const CustomerConsultationApiException(
        'The consultation request was created but no session was returned.',
      );
    }

    final call = Map<String, dynamic>.from(callSource);

    final id =
        call['id']?.toString().trim() ??
        call['callSessionId']?.toString().trim() ??
        '';

    if (id.isEmpty) {
      throw const CustomerConsultationApiException(
        'The server did not return a consultation ID.',
      );
    }

    return CustomerConsultationResult(
      consultationId: id,
      status: call['status']?.toString().trim().toUpperCase() ?? 'PENDING',
      expiresAt: DateTime.tryParse(call['expiresAt']?.toString() ?? ''),
      raw: call,
    );
  }

  final String consultationId;
  final String status;
  final DateTime? expiresAt;
  final Map<String, dynamic> raw;
}

class CustomerConsultationApi {
  CustomerConsultationApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<CustomerConsultationResult> startConsultation({
    required String astrologerUserId,
    required int purchasedMinutes,
    required CustomerConsultationMode mode,
  }) async {
    final normalizedAstrologerUserId = astrologerUserId.trim();

    if (normalizedAstrologerUserId.isEmpty) {
      throw const CustomerConsultationApiException(
        'Astrologer account ID is missing.',
      );
    }

    if (purchasedMinutes < 1 || purchasedMinutes > 180) {
      throw const CustomerConsultationApiException(
        'Consultation duration must be between 1 and 180 minutes.',
      );
    }

    final response = await _request(
      method: 'POST',
      path: '/consultations/start',
      payload: {
        'astrologerUserId': normalizedAstrologerUserId,
        'purchasedMinutes': purchasedMinutes,
        'mode': mode.apiValue,
      },
    );

    return CustomerConsultationResult.fromResponse(response);
  }

  Future<Map<String, dynamic>> getCurrent() {
    return _request(method: 'GET', path: '/consultations/current');
  }

  Future<Map<String, dynamic>> cancel(String consultationId) {
    return _request(
      method: 'PATCH',
      path:
          '/consultations/${Uri.encodeComponent(_normalizeId(consultationId))}/cancel',
    );
  }

  Future<Map<String, dynamic>> extend({
    required String consultationId,
    required int additionalMinutes,
  }) {
    if ((additionalMinutes != 5 && additionalMinutes != 10)) {
      throw const CustomerConsultationApiException(
        'Consultation can only be extended by 5 or 10 minutes.',
      );
    }

    return _request(
      method: 'PATCH',
      path:
          '/consultations/${Uri.encodeComponent(_normalizeId(consultationId))}/extend',
      payload: {'additionalMinutes': additionalMinutes},
    );
  }

  Future<Map<String, dynamic>> _request({
    required String method,
    required String path,
    Map<String, dynamic>? payload,
  }) async {
    final session = await _sessionStore.read();

    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const CustomerConsultationApiException(
        'Please login to start a consultation.',
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $token',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamed = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);

      final response = await http.Response.fromStream(streamed);

      final body = _decode(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body['success'] == true) {
        return body;
      }

      throw CustomerConsultationApiException(
        _readMessage(
          body,
          fallback: response.statusCode == 401
              ? 'Your session has expired. Please login again.'
              : 'Unable to start consultation.',
        ),
      );
    } on CustomerConsultationApiException {
      rethrow;
    } catch (_) {
      throw const CustomerConsultationApiException(
        'Unable to connect to consultations. Please try again.',
      );
    }
  }

  String _normalizeId(String value) {
    final normalized = value.trim();

    if (normalized.isEmpty) {
      throw const CustomerConsultationApiException(
        'Consultation ID is required.',
      );
    }

    return normalized;
  }

  Map<String, dynamic> _decode(String source) {
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
    } catch (_) {}

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
