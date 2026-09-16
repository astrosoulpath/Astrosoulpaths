import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'auth_portal.dart';

class AuthApiException implements Exception {
  const AuthApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

class SendOtpResult {
  const SendOtpResult({
    required this.message,
    required this.portal,
    this.devOtp,
  });

  final String message;
  final String portal;
  final String? devOtp;
}

class VerifyOtpResult {
  const VerifyOtpResult({
    required this.message,
    required this.portal,
    required this.role,
    required this.accessToken,
    required this.user,
    required this.session,
    required this.nextStep,
  });

  final String message;
  final String portal;
  final String role;
  final String accessToken;
  final Map<String, dynamic> user;
  final Map<String, dynamic> session;
  final String nextStep;

  String get refreshToken => session['refreshToken']?.toString() ?? '';

  int get expiresIn =>
      int.tryParse(session['expiresIn']?.toString() ?? '') ?? 0;

  Map<String, dynamic> get freeChat {
    final value = user['freeChat'];

    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return const <String, dynamic>{};
  }

  bool get freeChatEligible => freeChat['eligible'] == true;

  bool get freeChatUsed => freeChat['used'] == true;

  bool get showFreeChatPopup => freeChat['showPopup'] == true;

  int get freeChatMinutes =>
      int.tryParse(freeChat['minutes']?.toString() ?? '') ?? 0;
}

class AuthApi {
  AuthApi({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;

  Future<SendOtpResult> sendOtp({
    required String phone,
    required AuthPortal portal,
  }) async {
    final endpoint = switch (portal) {
      AuthPortal.customer => '/auth/send-otp',
      AuthPortal.astrologer => '/auth/astrologer/send-otp',
      AuthPortal.joinAstrologer => '/auth/join-astrologer/send-otp',
    };

    final body = await _post(
      endpoint: endpoint,
      payload: {'phone': phone},
      fallbackError: 'OTP could not be sent.',
    );

    return SendOtpResult(
      message: _readMessage(body, fallback: 'OTP sent successfully.'),
      portal: body['portal']?.toString() ?? portal.name,
      devOtp: _readOptionalString(body['devOtp']),
    );
  }

  Future<VerifyOtpResult> verifyOtp({
    required String phone,
    required String otp,
    required AuthPortal portal,
  }) async {
    final endpoint = switch (portal) {
      AuthPortal.customer => '/auth/verify-otp',
      AuthPortal.astrologer => '/auth/astrologer/verify-otp',
      AuthPortal.joinAstrologer => '/auth/join-astrologer/verify-otp',
    };

    final body = await _post(
      endpoint: endpoint,
      payload: {
        'phone': phone,
        // The existing backend DTO names the OTP field "token".
        'token': otp,
      },
      fallbackError: 'OTP verification failed.',
    );

    final user = _readMap(body['user']);
    final session = _readMap(body['session']);

    // The OTP phone is authoritative for phone-login sessions.
    // Some backend login responses do not include phone inside `user`.
    // Preserve it locally so every authenticated screen sees the
    // same verified number instead of "Phone unavailable".
    final responsePhone = user['phone']?.toString().trim() ?? '';
    if (responsePhone.isEmpty) {
      user['phone'] = phone.trim();
    }

    final accessToken =
        body['accessToken']?.toString() ??
        session['accessToken']?.toString() ??
        '';

    final role = body['role']?.toString() ?? user['role']?.toString() ?? '';

    final responsePortal =
        body['portal']?.toString() ?? user['portal']?.toString() ?? portal.name;

    final nextStep = body['nextStep']?.toString() ?? '';

    if (accessToken.isEmpty ||
        role.isEmpty ||
        responsePortal.isEmpty ||
        nextStep.isEmpty) {
      throw const AuthApiException(
        'The server returned an incomplete login response.',
      );
    }

    return VerifyOtpResult(
      message: _readMessage(body, fallback: 'Login successful.'),
      portal: responsePortal,
      role: role,
      accessToken: accessToken,
      user: user,
      session: session,
      nextStep: nextStep,
    );
  }

  Future<VerifyOtpResult> googleLogin({
    required String accessToken,
    required String refreshToken,
    required int expiresIn,
    required AuthPortal portal,
  }) async {
    final body = await _post(
      endpoint: '/auth/google',
      payload: {'accessToken': accessToken, 'portal': portal.name},
      fallbackError: 'Google login failed.',
    );

    final user = _readMap(body['user']);

    final role =
        body['role']?.toString() ?? user['role']?.toString() ?? 'CUSTOMER';

    final responsePortal =
        body['portal']?.toString() ?? user['portal']?.toString() ?? 'customer';

    final nextStep = body['nextStep']?.toString() ?? '';

    if (nextStep.isEmpty) {
      throw const AuthApiException(
        'The server returned an incomplete Google login response.',
      );
    }

    final session = <String, dynamic>{
      'accessToken': accessToken,
      'refreshToken': refreshToken,
      'expiresIn': expiresIn,
      'tokenType': 'bearer',
    };

    return VerifyOtpResult(
      message: _readMessage(body, fallback: 'Google login successful.'),
      portal: responsePortal,
      role: role,
      accessToken: accessToken,
      user: user,
      session: session,
      nextStep: nextStep,
    );
  }

  Future<Map<String, dynamic>> _post({
    required String endpoint,
    required Map<String, dynamic> payload,
    required String fallbackError,
  }) async {
    try {
      final response = await _client
          .post(
            Uri.parse('${ApiConfig.baseUrl}$endpoint'),
            headers: const {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: jsonEncode(payload),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw AuthApiException(_readMessage(body, fallback: fallbackError));
      }

      return body;
    } on AuthApiException {
      rethrow;
    } catch (_) {
      throw const AuthApiException(
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
    } catch (_) {
      // A consistent user-facing error is returned by the caller.
    }

    return <String, dynamic>{};
  }

  Map<String, dynamic> _readMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return <String, dynamic>{};
  }

  String? _readOptionalString(Object? value) {
    final text = value?.toString().trim() ?? '';

    return text.isEmpty ? null : text;
  }

  String _readMessage(Map<String, dynamic> body, {required String fallback}) {
    final directMessage = body['message'];

    if (directMessage is String && directMessage.trim().isNotEmpty) {
      return directMessage.trim();
    }

    if (directMessage is List && directMessage.isNotEmpty) {
      return directMessage.map((item) => item.toString()).join('\n');
    }

    final nestedResponse = body['response'];

    if (nestedResponse is Map) {
      final nestedMessage = nestedResponse['message'];

      if (nestedMessage is String && nestedMessage.trim().isNotEmpty) {
        return nestedMessage.trim();
      }
    }

    return fallback;
  }

  void close() {
    _client.close();
  }
}
