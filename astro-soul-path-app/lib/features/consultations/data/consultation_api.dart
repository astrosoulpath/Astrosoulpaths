import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import '../../wallet/data/customer_wallet.dart';
import 'consultation_models.dart';

class ConsultationApiException implements Exception {
  const ConsultationApiException(this.message, {this.code});

  final String message;
  final String? code;

  @override
  String toString() => message;
}

class ConsultationApi {
  ConsultationApi({http.Client? client, AuthSessionStore? sessionStore})
    : _client = client ?? http.Client(),
      _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  Future<StartConsultationResult> startConsultation({
    required String astrologerUserId,
    required int purchasedMinutes,
    required ConsultationMode mode,
  }) async {
    final normalizedAstrologerUserId = astrologerUserId.trim();

    if (normalizedAstrologerUserId.isEmpty) {
      throw const ConsultationApiException(
        'Astrologer account is not configured correctly.',
        code: 'ASTROLOGER_UNAVAILABLE',
      );
    }

    if (purchasedMinutes < 1 || purchasedMinutes > 180) {
      throw const ConsultationApiException(
        'Consultation duration must be between 1 and 180 minutes.',
      );
    }

    final body = await _authenticatedRequest(
      path: '/consultations/start',
      method: 'POST',
      payload: {
        'astrologerUserId': normalizedAstrologerUserId,
        'purchasedMinutes': purchasedMinutes,
        'mode': mode.apiValue,
      },
    );

    final data = body['data'];

    if (data is! Map) {
      throw const ConsultationApiException(
        'The server returned an invalid consultation response.',
      );
    }

    final normalizedData = Map<String, dynamic>.from(data);
    final callSource = normalizedData['call'];
    final walletSource = normalizedData['wallet'];

    if (callSource is! Map || walletSource is! Map) {
      throw const ConsultationApiException(
        'The server returned incomplete consultation data.',
      );
    }

    final session = ConsultationSession.fromJson(
      Map<String, dynamic>.from(callSource),
    );

    if (session.id.isEmpty) {
      throw const ConsultationApiException(
        'Consultation ID was not returned by the server.',
      );
    }

    return StartConsultationResult(
      message: _readMessage(
        body,
        fallback: 'Consultation request sent successfully.',
      ),
      session: session,
      wallet: CustomerWallet.fromJson(Map<String, dynamic>.from(walletSource)),
    );
  }

  Future<List<ConsultationHistoryItem>> getConsultationHistory({
    int page = 1,
    int limit = 20,
  }) async {
    final safePage = page < 1 ? 1 : page;
    final safeLimit = limit.clamp(1, 100);

    final body = await _authenticatedRequest(
      path: '/consultations/history?page=$safePage&limit=$safeLimit',
      method: 'GET',
    );

    final data = body['data'];

    if (data is! List) {
      throw const ConsultationApiException(
        'The server returned invalid consultation history.',
      );
    }

    return data
        .whereType<Map>()
        .map(
          (item) =>
              ConsultationHistoryItem.fromJson(Map<String, dynamic>.from(item)),
        )
        .where((item) => item.session.id.isNotEmpty)
        .toList(growable: false);
  }

  Future<ConsultationSession?> getCurrentConsultation() async {
    final body = await _authenticatedRequest(
      path: '/consultations/current',
      method: 'GET',
    );

    final data = body['data'];

    if (data == null) {
      return null;
    }

    if (data is! Map) {
      throw const ConsultationApiException(
        'The server returned invalid consultation data.',
      );
    }

    final session = ConsultationSession.fromJson(
      Map<String, dynamic>.from(data),
    );

    return session.id.isEmpty ? null : session;
  }

  Future<ConsultationSession> getConsultationById(String consultationId) async {
    final normalizedId = consultationId.trim();

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    final body = await _authenticatedRequest(
      path: '/consultations/${Uri.encodeComponent(normalizedId)}',
      method: 'GET',
    );

    return _readConsultation(
      body,
      fallback: 'The server returned invalid consultation details.',
    );
  }

  Future<ConsultationQueuePosition> getQueuePosition(
    String consultationId,
  ) async {
    final normalizedId = consultationId.trim();

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    final body = await _authenticatedRequest(
      path:
          '/consultations/${Uri.encodeComponent(normalizedId)}/queue-position',
      method: 'GET',
    );

    final rawData = body['data'];

    if (rawData is! Map) {
      throw const ConsultationApiException(
        'The server returned invalid queue information.',
      );
    }

    return ConsultationQueuePosition.fromJson(
      Map<String, dynamic>.from(rawData),
    );
  }

  Future<ConsultationSession> extendConsultation({
    required String consultationId,
    required int additionalMinutes,
  }) async {
    final normalizedId = consultationId.trim();

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    if ((additionalMinutes != 5 && additionalMinutes != 10)) {
      throw const ConsultationApiException(
        'Consultation can only be extended by 5 or 10 minutes.',
      );
    }

    final body = await _authenticatedRequest(
      path: '/consultations/${Uri.encodeComponent(normalizedId)}/extend',
      method: 'PATCH',
      payload: {'additionalMinutes': additionalMinutes},
    );

    return _readConsultation(
      body,
      fallback:
          'The server returned an invalid consultation extension response.',
    );
  }

  Future<ConsultationSession> completeConsultation(
    String consultationId,
  ) async {
    final normalizedId = consultationId.trim();

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    final body = await _authenticatedRequest(
      path: '/consultations/${Uri.encodeComponent(normalizedId)}/complete',
      method: 'PATCH',
    );

    return _readConsultation(
      body,
      fallback:
          'The server returned an invalid consultation completion response.',
    );
  }

  Future<void> rateConsultation({
    required String consultationId,
    required int rating,
    String? comment,
  }) async {
    final normalizedId = consultationId.trim();
    final normalizedComment = comment?.trim() ?? '';

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    if (rating < 1 || rating > 5) {
      throw const ConsultationApiException(
        'Rating must be between 1 and 5 stars.',
      );
    }

    if (normalizedComment.length > 1000) {
      throw const ConsultationApiException(
        'Review must not exceed 1000 characters.',
      );
    }

    await _authenticatedRequest(
      path: '/consultations/${Uri.encodeComponent(normalizedId)}/rating',
      method: 'POST',
      payload: {
        'rating': rating,
        if (normalizedComment.isNotEmpty) 'comment': normalizedComment,
      },
    );
  }

  Future<ConsultationSession> cancelConsultation(String consultationId) async {
    final normalizedId = consultationId.trim();

    if (normalizedId.isEmpty) {
      throw const ConsultationApiException('Consultation ID is required.');
    }

    final body = await _authenticatedRequest(
      path: '/consultations/${Uri.encodeComponent(normalizedId)}/cancel',
      method: 'PATCH',
    );

    return _readConsultation(
      body,
      fallback: 'The server returned an invalid cancellation response.',
    );
  }

  ConsultationSession _readConsultation(
    Map<String, dynamic> body, {
    required String fallback,
  }) {
    final data = body['data'];

    if (data is! Map) {
      throw ConsultationApiException(fallback);
    }

    final consultation = ConsultationSession.fromJson(
      Map<String, dynamic>.from(data),
    );

    if (consultation.id.isEmpty) {
      throw ConsultationApiException(fallback);
    }

    return consultation;
  }

  Future<Map<String, dynamic>> _authenticatedRequest({
    required String path,
    required String method,
    Map<String, dynamic>? payload,
  }) async {
    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const ConsultationApiException(
        'Please login to continue.',
        code: 'LOGIN_REQUIRED',
      );
    }

    try {
      final request = http.Request(
        method,
        Uri.parse('${ApiConfig.baseUrl}$path'),
      );

      request.headers.addAll({
        'Accept': 'application/json',
        'Authorization': 'Bearer $accessToken',
      });

      if (payload != null) {
        request.headers['Content-Type'] = 'application/json';
        request.body = jsonEncode(payload);
      }

      final streamedResponse = await _client
          .send(request)
          .timeout(ApiConfig.requestTimeout);
      final response = await http.Response.fromStream(streamedResponse);
      final body = _decodeBody(response.body);

      if (response.statusCode >= 200 &&
          response.statusCode < 300 &&
          body['success'] == true) {
        return body;
      }

      final message = _readMessage(
        body,
        fallback: 'Consultation request failed.',
      );

      throw ConsultationApiException(
        _userFacingMessage(statusCode: response.statusCode, message: message),
        code: _errorCode(statusCode: response.statusCode, message: message),
      );
    } on ConsultationApiException {
      rethrow;
    } catch (_) {
      throw const ConsultationApiException(
        'Unable to connect to the server. Please try again.',
        code: 'CONNECTION_ERROR',
      );
    }
  }

  String _errorCode({required int statusCode, required String message}) {
    final normalized = message.toLowerCase();

    if (statusCode == 401) {
      return 'LOGIN_REQUIRED';
    }

    if (normalized.contains('insufficient')) {
      return 'INSUFFICIENT_BALANCE';
    }

    if (normalized.contains('active consultation')) {
      return 'ACTIVE_CONSULTATION_EXISTS';
    }

    if (normalized.contains('busy')) {
      return 'ASTROLOGER_BUSY';
    }

    if (normalized.contains('offline') ||
        normalized.contains('unavailable') ||
        normalized.contains('not approved') ||
        normalized.contains('unverified')) {
      return 'ASTROLOGER_UNAVAILABLE';
    }

    return 'CONSULTATION_ERROR';
  }

  String _userFacingMessage({
    required int statusCode,
    required String message,
  }) {
    final code = _errorCode(statusCode: statusCode, message: message);

    return switch (code) {
      'LOGIN_REQUIRED' => 'Your session has expired. Please login again.',
      'INSUFFICIENT_BALANCE' =>
        'Your available wallet balance is insufficient.',
      'ACTIVE_CONSULTATION_EXISTS' =>
        'You already have an active consultation.',
      'ASTROLOGER_BUSY' => 'This astrologer is currently busy.',
      'ASTROLOGER_UNAVAILABLE' => 'This astrologer is currently unavailable.',
      _ => message,
    };
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
      // The caller returns a consistent error.
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
