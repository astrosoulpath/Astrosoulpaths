import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import 'package:http_parser/http_parser.dart';
import '../../../core/config/api_config.dart';
import '../../auth/data/auth_session_store.dart';
import 'astrologer_manual_kundli_report.dart';

class AstrologerManualKundliReportApiException implements Exception {
  const AstrologerManualKundliReportApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class AstrologerManualKundliReportApi {
  AstrologerManualKundliReportApi({
    http.Client? client,
    AuthSessionStore? sessionStore,
  }) : _client = client ?? http.Client(),
       _sessionStore = sessionStore ?? AuthSessionStore();

  final http.Client _client;
  final AuthSessionStore _sessionStore;

  static const String _basePath = '/kundli/manual-reports';

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    final token = session?.accessToken.trim() ?? '';

    if (token.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Login session not found. Please login again.',
      );
    }

    return token;
  }

  Uri _uri(String path) {
    return Uri.parse('${ApiConfig.baseUrl}$path');
  }

  Future<Map<String, String>> _headers({bool jsonBody = false}) async {
    final token = await _accessToken();

    return <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
      if (jsonBody) 'Content-Type': 'application/json',
    };
  }

  dynamic _decode(http.Response response) {
    if (response.body.trim().isEmpty) {
      return null;
    }

    try {
      return jsonDecode(response.body);
    } catch (_) {
      throw const AstrologerManualKundliReportApiException(
        'Server returned an invalid response.',
      );
    }
  }

  Never _throwResponse(http.Response response, dynamic decoded) {
    var message = 'Unable to process Kundli report request.';

    if (decoded is Map) {
      final rawMessage = decoded['message'];

      if (rawMessage is List && rawMessage.isNotEmpty) {
        message = rawMessage.map((item) => item.toString()).join(', ');
      } else if (rawMessage != null &&
          rawMessage.toString().trim().isNotEmpty) {
        message = rawMessage.toString().trim();
      } else if (decoded['error'] != null &&
          decoded['error'].toString().trim().isNotEmpty) {
        message = decoded['error'].toString().trim();
      }
    }

    throw AstrologerManualKundliReportApiException(message);
  }

  Map<String, dynamic> _extractReport(dynamic decoded) {
    if (decoded is Map<String, dynamic>) {
      final data = decoded['data'];

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return decoded;
    }

    if (decoded is Map) {
      final map = Map<String, dynamic>.from(decoded);
      final data = map['data'];

      if (data is Map) {
        return Map<String, dynamic>.from(data);
      }

      return map;
    }

    throw const AstrologerManualKundliReportApiException(
      'Kundli report response is invalid.',
    );
  }

  List<AstrologerManualKundliReport> _extractList(dynamic decoded) {
    dynamic source = decoded;

    if (decoded is Map) {
      source = decoded['data'];
    }

    if (source is! List) {
      throw const AstrologerManualKundliReportApiException(
        'Kundli report list response is invalid.',
      );
    }

    return source
        .whereType<Map>()
        .map(
          (item) => AstrologerManualKundliReport.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList(growable: false);
  }

  Future<AstrologerManualKundliReport> createOrGetDraft({
    required String callSessionId,
  }) async {
    final id = callSessionId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Consultation session is required.',
      );
    }

    final response = await _client
        .post(
          _uri('$_basePath/consultations/${Uri.encodeComponent(id)}/draft'),
          headers: await _headers(jsonBody: true),
          body: '{}',
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return AstrologerManualKundliReport.fromJson(_extractReport(decoded));
  }

  Future<AstrologerManualKundliReport> updateDraft({
    required String reportId,
    String? title,
    String? summary,
    String? character,
    String? career,
    String? marriage,
    String? finance,
    String? health,
    String? remedies,
    String? notes,
  }) async {
    final id = reportId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report ID is required.',
      );
    }

    final body = <String, dynamic>{
      'title': title,
      'summary': summary,
      'character': character,
      'career': career,
      'marriage': marriage,
      'finance': finance,
      'health': health,
      'remedies': remedies,
      'notes': notes,
    };

    final response = await _client
        .patch(
          _uri('$_basePath/${Uri.encodeComponent(id)}'),
          headers: await _headers(jsonBody: true),
          body: jsonEncode(body),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return AstrologerManualKundliReport.fromJson(_extractReport(decoded));
  }

  Future<AstrologerManualKundliReport> finalize({
    required String reportId,
  }) async {
    final id = reportId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report ID is required.',
      );
    }

    final response = await _client
        .post(
          _uri('$_basePath/${Uri.encodeComponent(id)}/finalize'),
          headers: await _headers(jsonBody: true),
          body: '{}',
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return AstrologerManualKundliReport.fromJson(_extractReport(decoded));
  }

  Future<List<AstrologerManualKundliReport>> getAstrologerReports() async {
    final response = await _client
        .get(_uri('$_basePath/astrologer'), headers: await _headers())
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return _extractList(decoded);
  }

  Future<List<AstrologerManualKundliReport>> getCustomerFinalReports() async {
    final response = await _client
        .get(_uri('$_basePath/customer/final'), headers: await _headers())
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return _extractList(decoded);
  }

  MediaType _attachmentMediaType(String fileName) {
    final normalized = fileName.trim().toLowerCase();

    if (normalized.endsWith('.pdf')) {
      return MediaType('application', 'pdf');
    }

    if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
      return MediaType('image', 'jpeg');
    }

    if (normalized.endsWith('.png')) {
      return MediaType('image', 'png');
    }

    throw const AstrologerManualKundliReportApiException(
      'Only PDF, JPG and PNG files are supported.',
    );
  }

  Future<AstrologerManualKundliReportAttachment> uploadAttachment({
    required String reportId,
    required String fileName,
    required Uint8List bytes,
  }) async {
    final id = reportId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report ID is required.',
      );
    }

    if (bytes.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Selected file is empty.',
      );
    }

    if (bytes.length > 10 * 1024 * 1024) {
      throw const AstrologerManualKundliReportApiException(
        'Attachment must be 10 MB or smaller.',
      );
    }

    final token = await _accessToken();

    final request = http.MultipartRequest(
      'POST',
      _uri('$_basePath/${Uri.encodeComponent(id)}/attachments'),
    );

    request.headers.addAll({
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    });

    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: fileName,
        contentType: _attachmentMediaType(fileName),
      ),
    );

    final streamedResponse = await _client
        .send(request)
        .timeout(ApiConfig.requestTimeout);

    final response = await http.Response.fromStream(streamedResponse);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    return AstrologerManualKundliReportAttachment.fromJson(
      _extractReport(decoded),
    );
  }

  Future<List<AstrologerManualKundliReportAttachment>> getAttachments({
    required String reportId,
  }) async {
    final id = reportId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report ID is required.',
      );
    }

    final response = await _client
        .get(
          _uri('$_basePath/${Uri.encodeComponent(id)}/attachments'),
          headers: await _headers(),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }

    dynamic source = decoded;

    if (decoded is Map) {
      source = decoded['data'];
    }

    if (source is! List) {
      throw const AstrologerManualKundliReportApiException(
        'Attachment list response is invalid.',
      );
    }

    return source
        .whereType<Map>()
        .map(
          (item) => AstrologerManualKundliReportAttachment.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList(growable: false);
  }

  Future<void> deleteAttachment({
    required String reportId,
    required String attachmentId,
  }) async {
    final normalizedReportId = reportId.trim();
    final normalizedAttachmentId = attachmentId.trim();

    if (normalizedReportId.isEmpty || normalizedAttachmentId.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report and attachment IDs are required.',
      );
    }

    final response = await _client
        .delete(
          _uri(
            '$_basePath/'
            '${Uri.encodeComponent(normalizedReportId)}/'
            'attachments/'
            '${Uri.encodeComponent(normalizedAttachmentId)}',
          ),
          headers: await _headers(),
        )
        .timeout(ApiConfig.requestTimeout);

    final decoded = _decode(response);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      _throwResponse(response, decoded);
    }
  }

  Future<Uint8List> downloadAttachmentBytes({
    required String signedUrl,
    required String expectedMimeType,
  }) async {
    final rawUrl = signedUrl.trim();
    final uri = Uri.tryParse(rawUrl);

    if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
      throw const AstrologerManualKundliReportApiException(
        'Attachment link is unavailable.',
      );
    }

    try {
      final response = await _client
          .get(
            uri,
            headers: const {
              'Accept': 'image/jpeg,image/png,application/pdf,*/*',
            },
          )
          .timeout(const Duration(seconds: 30));

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AstrologerManualKundliReportApiException(
          'Unable to download attachment (${response.statusCode}).',
        );
      }

      final contentType = (response.headers['content-type'] ?? '')
          .toLowerCase();

      final expected = expectedMimeType.trim().toLowerCase();

      if (expected == 'image/jpeg' && !contentType.contains('image/jpeg')) {
        throw const AstrologerManualKundliReportApiException(
          'The attachment is not a valid JPEG image.',
        );
      }

      if (expected == 'image/png' && !contentType.contains('image/png')) {
        throw const AstrologerManualKundliReportApiException(
          'The attachment is not a valid PNG image.',
        );
      }

      if (response.bodyBytes.isEmpty) {
        throw const AstrologerManualKundliReportApiException(
          'The attachment is empty.',
        );
      }

      if (response.bodyBytes.length > 10 * 1024 * 1024) {
        throw const AstrologerManualKundliReportApiException(
          'Attachment is larger than 10 MB.',
        );
      }

      return Uint8List.fromList(response.bodyBytes);
    } on AstrologerManualKundliReportApiException {
      rethrow;
    } catch (error, stackTrace) {
      debugPrint(
        'KUNDLI_ATTACHMENT_DOWNLOAD_ERROR '
        'type=${error.runtimeType} error=$error',
      );
      debugPrintStack(
        label: 'KUNDLI_ATTACHMENT_DOWNLOAD_STACK',
        stackTrace: stackTrace,
      );

      throw AstrologerManualKundliReportApiException(
        'Unable to download attachment: ${error.runtimeType}',
      );
    }
  }

  void close() {
    _client.close();
  }

  Future<Uint8List> downloadReportPdf({required String reportId}) async {
    final id = reportId.trim();

    if (id.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Report ID is required.',
      );
    }

    final session = await _sessionStore.read();
    final accessToken = session?.accessToken.trim() ?? '';

    if (accessToken.isEmpty) {
      throw const AstrologerManualKundliReportApiException(
        'Please login to continue.',
      );
    }

    try {
      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/kundli/manual-reports/$id/pdf'),
            headers: {
              'Accept': 'application/pdf',
              'Authorization': 'Bearer $accessToken',
            },
          )
          .timeout(const Duration(seconds: 60));

      if (response.statusCode == 401) {
        throw const AstrologerManualKundliReportApiException(
          'Your session has expired. Please login again.',
        );
      }

      if (response.statusCode == 403) {
        throw const AstrologerManualKundliReportApiException(
          'You cannot access this professional Kundli report.',
        );
      }

      if (response.statusCode == 404) {
        throw const AstrologerManualKundliReportApiException(
          'Professional Kundli report was not found.',
        );
      }

      if (response.statusCode == 409) {
        throw const AstrologerManualKundliReportApiException(
          'PDF is available only after the report is finalized.',
        );
      }

      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw AstrologerManualKundliReportApiException(
          'Unable to generate professional Kundli PDF '
          '(HTTP ${response.statusCode}).',
        );
      }

      final contentType = response.headers['content-type']?.toLowerCase() ?? '';

      if (!contentType.contains('application/pdf')) {
        throw const AstrologerManualKundliReportApiException(
          'The server returned an invalid professional Kundli PDF.',
        );
      }

      if (response.bodyBytes.isEmpty) {
        throw const AstrologerManualKundliReportApiException(
          'The generated professional Kundli PDF is empty.',
        );
      }

      return Uint8List.fromList(response.bodyBytes);
    } on AstrologerManualKundliReportApiException {
      rethrow;
    } catch (_) {
      throw const AstrologerManualKundliReportApiException(
        'Unable to connect to the professional Kundli PDF service.',
      );
    }
  }
}
