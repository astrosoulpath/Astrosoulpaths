import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'support_models.dart';

class SupportApiException implements Exception {
  const SupportApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class SupportApi {
  SupportApi({required String accessToken, http.Client? client})
    : _accessToken = accessToken.trim(),
      _client = client ?? http.Client();

  final String _accessToken;
  final http.Client _client;

  Map<String, String> get _headers => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $_accessToken',
  };

  Uri _uri(String path) {
    return Uri.parse('${ApiConfig.baseUrl}$path');
  }

  Map<String, dynamic> _decodeResponse(http.Response response) {
    Map<String, dynamic> body = {};

    if (response.body.trim().isNotEmpty) {
      final decoded = jsonDecode(response.body);

      if (decoded is Map) {
        body = Map<String, dynamic>.from(decoded);
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final rawMessage = body['message'];

      final message = rawMessage is List
          ? rawMessage.join(', ')
          : rawMessage?.toString();

      throw SupportApiException(
        message?.trim().isNotEmpty == true
            ? message!
            : 'Support request failed.',
        statusCode: response.statusCode,
      );
    }

    return body;
  }

  Future<http.Response> _get(String path) {
    return _client
        .get(_uri(path), headers: _headers)
        .timeout(ApiConfig.requestTimeout);
  }

  Future<http.Response> _post(String path, {Map<String, dynamic>? body}) {
    return _client
        .post(_uri(path), headers: _headers, body: jsonEncode(body ?? const {}))
        .timeout(ApiConfig.requestTimeout);
  }

  Future<http.Response> _patch(String path, {Map<String, dynamic>? body}) {
    return _client
        .patch(
          _uri(path),
          headers: _headers,
          body: jsonEncode(body ?? const {}),
        )
        .timeout(ApiConfig.requestTimeout);
  }

  // =========================================================
  // HUMAN SUPPORT TICKETS
  // =========================================================

  Future<List<SupportTicketSummary>> getMyTickets() async {
    final response = await _get('/support/tickets');

    final json = _decodeResponse(response);

    final tickets = json['tickets'];

    if (tickets is! List) {
      return const [];
    }

    return tickets
        .whereType<Map>()
        .map(
          (item) =>
              SupportTicketSummary.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList();
  }

  Future<SupportTicketDetail> getTicket(String ticketId) async {
    final response = await _get(
      '/support/tickets/${Uri.encodeComponent(ticketId)}',
    );

    final json = _decodeResponse(response);

    final rawTicket = json['ticket'];

    if (rawTicket is! Map) {
      throw const SupportApiException('Invalid support ticket response.');
    }

    return SupportTicketDetail.fromJson(Map<String, dynamic>.from(rawTicket));
  }

  Future<SupportTicketDetail> createTicket({
    required String subject,
    String? description,
    String? contactEmail,
    String category = 'GENERAL',
    String? relatedCallSessionId,
    String? relatedPaymentId,
    String? relatedWalletTxnId,
  }) async {
    final payload = <String, dynamic>{
      'subject': subject.trim(),
      'category': category,
    };

    final cleanDescription = description?.trim();

    if (cleanDescription != null && cleanDescription.isNotEmpty) {
      payload['description'] = cleanDescription;
    }
    final cleanContactEmail = contactEmail?.trim().toLowerCase();

    if (cleanContactEmail != null && cleanContactEmail.isNotEmpty) {
      payload['contactEmail'] = cleanContactEmail;
    }

    if (relatedCallSessionId?.trim().isNotEmpty == true) {
      payload['relatedCallSessionId'] = relatedCallSessionId!.trim();
    }

    if (relatedPaymentId?.trim().isNotEmpty == true) {
      payload['relatedPaymentId'] = relatedPaymentId!.trim();
    }

    if (relatedWalletTxnId?.trim().isNotEmpty == true) {
      payload['relatedWalletTxnId'] = relatedWalletTxnId!.trim();
    }

    final response = await _post('/support/tickets', body: payload);

    final json = _decodeResponse(response);

    final rawTicket = json['ticket'];

    if (rawTicket is! Map) {
      throw const SupportApiException('Invalid support ticket response.');
    }

    return SupportTicketDetail.fromJson(Map<String, dynamic>.from(rawTicket));
  }

  Future<SupportMessageModel> sendTicketMessage({
    required String ticketId,
    required String content,
    String? clientMessageId,
  }) async {
    final payload = <String, dynamic>{'content': content.trim()};

    if (clientMessageId?.trim().isNotEmpty == true) {
      payload['clientMessageId'] = clientMessageId!.trim();
    }

    final response = await _post(
      '/support/tickets/${Uri.encodeComponent(ticketId)}/messages',
      body: payload,
    );

    final json = _decodeResponse(response);

    final rawMessage = json['message'];

    if (rawMessage is! Map) {
      throw const SupportApiException('Invalid support message response.');
    }

    return SupportMessageModel.fromJson(Map<String, dynamic>.from(rawMessage));
  }

  Future<void> markTicketRead(String ticketId) async {
    final response = await _patch(
      '/support/tickets/${Uri.encodeComponent(ticketId)}/read',
    );

    _decodeResponse(response);
  }

  // =========================================================
  // 24x7 AI SUPPORT ASSISTANT
  // =========================================================

  Future<bool> isAssistantAvailable() async {
    final response = await _get('/support/assistant/health');

    final json = _decodeResponse(response);

    final provider = json['provider'];

    return provider is Map && provider['available'] == true;
  }

  Future<AssistantConversationModel> startOrGetAssistantConversation() async {
    final response = await _post('/support/assistant/conversations');

    final json = _decodeResponse(response);

    final rawConversation = json['conversation'];

    if (rawConversation is! Map) {
      throw const SupportApiException(
        'Invalid assistant conversation response.',
      );
    }

    return AssistantConversationModel.fromJson(
      Map<String, dynamic>.from(rawConversation),
    );
  }

  Future<AssistantConversationModel> getAssistantConversation(
    String conversationId,
  ) async {
    final response = await _get(
      '/support/assistant/conversations/${Uri.encodeComponent(conversationId)}',
    );

    final json = _decodeResponse(response);

    final rawConversation = json['conversation'];

    if (rawConversation is! Map) {
      throw const SupportApiException(
        'Invalid assistant conversation response.',
      );
    }

    return AssistantConversationModel.fromJson(
      Map<String, dynamic>.from(rawConversation),
    );
  }

  Future<AssistantSendResult> sendAssistantMessage({
    required String conversationId,
    required String content,
    String? clientMessageId,
  }) async {
    final payload = <String, dynamic>{'content': content.trim()};

    if (clientMessageId?.trim().isNotEmpty == true) {
      payload['clientMessageId'] = clientMessageId!.trim();
    }

    final response = await _post(
      '/support/assistant/conversations/${Uri.encodeComponent(conversationId)}/messages',
      body: payload,
    );

    final json = _decodeResponse(response);

    final rawCustomerMessage = json['message'];

    if (rawCustomerMessage is! Map) {
      throw const SupportApiException('Invalid assistant message response.');
    }

    final rawAssistantReply = json['assistantReply'];

    return AssistantSendResult(
      customerMessage: SupportMessageModel.fromJson(
        Map<String, dynamic>.from(rawCustomerMessage),
      ),
      assistantReply: rawAssistantReply is Map
          ? SupportMessageModel.fromJson(
              Map<String, dynamic>.from(rawAssistantReply),
            )
          : null,
      providerStatus: json['assistantProviderStatus']?.toString() ?? 'UNKNOWN',
    );
  }

  Future<SupportTicketDetail> escalateAssistantToHuman({
    required String conversationId,
    String? subject,
    String? description,
  }) async {
    final payload = <String, dynamic>{};

    if (subject?.trim().isNotEmpty == true) {
      payload['subject'] = subject!.trim();
    }

    if (description?.trim().isNotEmpty == true) {
      payload['description'] = description!.trim();
    }

    final response = await _post(
      '/support/assistant/conversations/${Uri.encodeComponent(conversationId)}/escalate',
      body: payload,
    );

    final json = _decodeResponse(response);

    final rawTicket = json['ticket'];

    if (rawTicket is! Map) {
      throw const SupportApiException('Invalid escalation response.');
    }

    return SupportTicketDetail.fromJson(Map<String, dynamic>.from(rawTicket));
  }

  Future<void> closeAssistantConversation(String conversationId) async {
    final response = await _patch(
      '/support/assistant/conversations/${Uri.encodeComponent(conversationId)}/close',
    );

    _decodeResponse(response);
  }

  Future<Map<String, dynamic>> uploadTicketAttachment({
    required String ticketId,
    required String filePath,
  }) async {
    final normalizedTicketId = ticketId.trim();
    final normalizedPath = filePath.trim();

    if (normalizedTicketId.isEmpty) {
      throw const SupportApiException('Ticket ID is required.');
    }

    if (normalizedPath.isEmpty) {
      throw const SupportApiException('Attachment file is required.');
    }

    if (_accessToken.isEmpty) {
      throw const SupportApiException(
        'Please login again to upload the attachment.',
      );
    }

    final request = http.MultipartRequest(
      'POST',
      _uri(
        '/support/tickets/'
        '${Uri.encodeComponent(normalizedTicketId)}'
        '/attachments',
      ),
    );

    request.headers.addAll({
      'Accept': 'application/json',
      'Authorization': 'Bearer $_accessToken',
    });

    request.files.add(
      await http.MultipartFile.fromPath('file', normalizedPath),
    );

    final streamedResponse = await _client
        .send(request)
        .timeout(ApiConfig.requestTimeout);

    final response = await http.Response.fromStream(streamedResponse);

    Map<String, dynamic> json;

    try {
      final decoded = jsonDecode(response.body);

      json = decoded is Map
          ? Map<String, dynamic>.from(decoded)
          : <String, dynamic>{};
    } catch (_) {
      json = <String, dynamic>{};
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final rawMessage = json['message'];

      final message = rawMessage is List
          ? rawMessage.map((item) => item.toString()).join(', ')
          : rawMessage?.toString();

      throw SupportApiException(
        message?.trim().isNotEmpty == true
            ? message!.trim()
            : 'Unable to upload support attachment.',
      );
    }

    return json;
  }

  void close() {
    _client.close();
  }
}
