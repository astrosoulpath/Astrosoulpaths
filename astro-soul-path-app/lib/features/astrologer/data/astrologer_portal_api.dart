import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import '../../../core/config/api_config.dart';

class AstrologerPortalApiException implements Exception {
  const AstrologerPortalApiException(this.message, {this.statusCode});

  final int? statusCode;
  bool get accessDenied => statusCode == 401 || statusCode == 403;

  final String message;

  @override
  String toString() => message;
}

class AstrologerPortalApi {
  AstrologerPortalApi({http.Client? client})
    : _client = client ?? http.Client();

  final http.Client _client;

  MediaType _uploadType(String path, {bool allowPdf = false}) {
    final extension = path.split('.').last.toLowerCase();
    return switch (extension) {
      'pdf' when allowPdf => MediaType('application', 'pdf'),
      'png' => MediaType('image', 'png'),
      'jpg' || 'jpeg' => MediaType('image', 'jpeg'),
      'webp' when !allowPdf => MediaType('image', 'webp'),
      _ => throw const AstrologerPortalApiException(
        'Please select a supported document or image type.',
      ),
    };
  }

  Future<Map<String, dynamic>> register({
    required String accessToken,
    required String fullName,
    required String email,
    required String phoneNumber,
    required List<String> languages,
    required List<String> expertise,
    required int experienceYears,
    required double consultationPrice,
    String? bio,
    Map<String, dynamic>? documents,
  }) async {
    final token = accessToken.trim();

    if (token.isEmpty) {
      throw const AstrologerPortalApiException(
        'Your login session is missing. Please verify your mobile number again.',
      );
    }

    final response = await _client
        .post(
          Uri.parse('${ApiConfig.baseUrl}/astrologer/register'),
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer $token',
          },
          body: jsonEncode({
            'fullName': fullName.trim(),
            if (email.trim().isNotEmpty) 'email': email.trim(),
            'phoneNumber': phoneNumber.trim(),
            'languages': languages,
            'expertise': expertise,
            'experienceYears': experienceYears,
            'consultationPrice': consultationPrice,
            if (bio != null && bio.trim().isNotEmpty) 'bio': bio.trim(),
            'documents': ?documents,
          }),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body['success'] != true) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to submit astrologer application.'),
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> uploadKycDocument({
    required String accessToken,
    required String filePath,
    required String documentType,
  }) async {
    final token = accessToken.trim();
    final normalizedPath = filePath.trim();
    final normalizedType = documentType.trim().toLowerCase();

    if (token.isEmpty) {
      throw const AstrologerPortalApiException(
        'Your session has expired. Please verify your mobile number again.',
      );
    }

    if (normalizedPath.isEmpty) {
      throw const AstrologerPortalApiException('Please select a KYC document.');
    }

    if (!const {
      'identity',
      'certificate',
      'experience',
    }.contains(normalizedType)) {
      throw const AstrologerPortalApiException('Invalid KYC document type.');
    }

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/astrologer/kyc/upload'),
    );

    request.headers.addAll({
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    });

    request.fields['documentType'] = normalizedType;

    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        normalizedPath,
        contentType: _uploadType(normalizedPath, allowPdf: true),
      ),
    );

    final streamedResponse = await _client
        .send(request)
        .timeout(ApiConfig.requestTimeout);

    final response = await http.Response.fromStream(streamedResponse);
    final body = _decode(response.body);

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body['success'] != true) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to upload KYC document.'),
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> uploadProfileAvatar({
    required String accessToken,
    required String filePath,
  }) async {
    final token = accessToken.trim();
    final normalizedPath = filePath.trim();

    if (token.isEmpty) {
      throw const AstrologerPortalApiException(
        'Your login session has expired. Please login again.',
      );
    }

    if (normalizedPath.isEmpty) {
      throw const AstrologerPortalApiException(
        'Please select a profile image.',
      );
    }

    final request = http.MultipartRequest(
      'POST',
      Uri.parse('${ApiConfig.baseUrl}/profile/avatar'),
    );

    request.headers.addAll({
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    });

    request.files.add(
      await http.MultipartFile.fromPath(
        'file',
        normalizedPath,
        contentType: _uploadType(normalizedPath),
      ),
    );

    final streamedResponse = await _client
        .send(request)
        .timeout(ApiConfig.requestTimeout);

    final response = await http.Response.fromStream(streamedResponse);
    final body = _decode(response.body);

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body['success'] != true) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to upload profile image.'),
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> getProfile({required String accessToken}) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/profile',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> updateProfile({
    required String accessToken,
    required Map<String, dynamic> profile,
  }) async {
    return _authorizedRequest(
      method: 'PATCH',
      endpoint: '/astrologer/profile',
      accessToken: accessToken,
      payload: profile,
    );
  }

  Future<Map<String, dynamic>> getAvailability({
    required String accessToken,
  }) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/availability',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> updateAvailability({
    required String accessToken,
    required String timezone,
    required List<Map<String, dynamic>> days,
  }) async {
    return _authorizedRequest(
      method: 'PATCH',
      endpoint: '/astrologer/availability',
      accessToken: accessToken,
      payload: {'timezone': timezone, 'days': days},
    );
  }

  Future<Map<String, dynamic>> getEarningsSummary({
    required String accessToken,
  }) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/earnings/summary',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> getEarningsTransactions({
    required String accessToken,
  }) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/earnings/transactions',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> getPayoutBankAccount({
    required String accessToken,
  }) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/earnings/bank-account',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> savePayoutBankAccount({
    required String accessToken,
    required String accountHolderName,
    required String accountNumber,
    required String ifsc,
    String? bankName,
  }) async {
    return _authorizedRequest(
      method: 'POST',
      endpoint: '/astrologer/earnings/bank-account',
      accessToken: accessToken,
      payload: {
        'accountHolderName': accountHolderName.trim(),
        'accountNumber': accountNumber.trim(),
        'ifsc': ifsc.trim().toUpperCase(),
        if (bankName != null && bankName.trim().isNotEmpty)
          'bankName': bankName.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> getPayoutHistory({
    required String accessToken,
  }) async {
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/earnings/payouts',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> requestPayout({
    required String accessToken,
    String mode = 'IMPS',
  }) async {
    return _authorizedRequest(
      method: 'POST',
      endpoint: '/astrologer/earnings/payout-request',
      accessToken: accessToken,
      payload: {'mode': mode.trim().toUpperCase()},
    );
  }

  Future<Map<String, dynamic>> getCustomerHistory({
    required String accessToken,
    int page = 1,
    int limit = 20,
    String search = '',
    String mode = '',
    String status = '',
  }) async {
    final query = Uri(
      queryParameters: {
        'page': '$page',
        'limit': '$limit',
        if (search.trim().isNotEmpty) 'search': search.trim(),
        if (mode.isNotEmpty) 'mode': mode,
        if (status.isNotEmpty) 'status': status,
      },
    ).query;
    return _authorizedRequest(
      method: 'GET',
      endpoint: '/consultations/astrologer/history?$query',
      accessToken: accessToken,
    );
  }

  Future<Map<String, dynamic>> getDashboard({
    required String accessToken,
  }) async {
    final response = await _authorizedRequest(
      method: 'GET',
      endpoint: '/astrologer/dashboard',
      accessToken: accessToken,
    );
    final data = response['data'];
    if (response['success'] != true ||
        data is! Map ||
        data['isOnline'] is! bool ||
        data['isApproved'] is! bool ||
        data['isVerified'] is! bool ||
        data['userId'] is! String ||
        data['astrologerId'] is! String) {
      throw const AstrologerPortalApiException(
        'Invalid dashboard response. Please retry.',
      );
    }
    return response;
  }

  Future<Map<String, dynamic>> updateStatus({
    required String accessToken,
    required bool isOnline,
  }) async {
    return _authorizedRequest(
      method: 'PATCH',
      endpoint: '/astrologer/status',
      accessToken: accessToken,
      payload: {'isOnline': isOnline},
    );
  }

  Future<Map<String, dynamic>> _authorizedRequest({
    required String method,
    required String endpoint,
    required String accessToken,
    Map<String, dynamic>? payload,
  }) async {
    try {
      return await _performAuthorizedRequest(
        method: method,
        endpoint: endpoint,
        accessToken: accessToken,
        payload: payload,
      );
    } on AstrologerPortalApiException {
      rethrow;
    } catch (_) {
      throw const AstrologerPortalApiException(
        'Unable to reach the astrologer service. Check your connection and retry.',
      );
    }
  }

  Future<Map<String, dynamic>> _performAuthorizedRequest({
    required String method,
    required String endpoint,
    required String accessToken,
    Map<String, dynamic>? payload,
  }) async {
    final token = accessToken.trim();

    if (token.isEmpty) {
      throw const AstrologerPortalApiException(
        'Your session has expired. Please login again.',
      );
    }

    final uri = Uri.parse('${ApiConfig.baseUrl}$endpoint');

    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': 'Bearer $token',
    };

    late http.Response response;

    if (method == 'PATCH') {
      response = await _client
          .patch(
            uri,
            headers: headers,
            body: jsonEncode(payload ?? <String, dynamic>{}),
          )
          .timeout(ApiConfig.requestTimeout);
    } else if (method == 'POST') {
      response = await _client
          .post(
            uri,
            headers: headers,
            body: jsonEncode(payload ?? <String, dynamic>{}),
          )
          .timeout(ApiConfig.requestTimeout);
    } else {
      response = await _client
          .get(uri, headers: headers)
          .timeout(ApiConfig.requestTimeout);
    }

    final body = _decode(response.body);

    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        body.isEmpty ||
        body['success'] == false) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to load astrologer dashboard.'),
        statusCode: response.statusCode,
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> getQualificationStatus({
    required String accessToken,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/astrologer/qualification/status',
    );

    final response = await _client
        .get(
          uri,
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Accept': 'application/json',
          },
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to load qualification status.'),
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> getQualificationQuestions({
    required String accessToken,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/astrologer/qualification/questions',
    );

    final response = await _client
        .get(
          uri,
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Accept': 'application/json',
          },
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to load qualification questions.'),
      );
    }

    return body;
  }

  Future<Map<String, dynamic>> submitQualification({
    required String accessToken,
    required List<Map<String, String>> answers,
  }) async {
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/astrologer/qualification/submit',
    );

    final response = await _client
        .post(
          uri,
          headers: {
            'Authorization': 'Bearer $accessToken',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({'answers': answers}),
        )
        .timeout(ApiConfig.requestTimeout);

    final body = _decode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AstrologerPortalApiException(
        _message(body, 'Unable to submit qualification test.'),
      );
    }

    return body;
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

  String _message(Map<String, dynamic> body, String fallback) {
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
