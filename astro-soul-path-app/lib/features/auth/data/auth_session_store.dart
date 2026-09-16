// ignore_for_file: prefer_initializing_formals

import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'auth_api.dart';

class AuthSessionStore {
  AuthSessionStore({FlutterSecureStorage? storage, http.Client? refreshClient})
    : _storage = storage ?? const FlutterSecureStorage(),
      _refreshClient = refreshClient;

  static const _accessTokenKey = 'asp_access_token';
  static const _refreshTokenKey = 'asp_refresh_token';
  static const _roleKey = 'asp_role';
  static const _portalKey = 'asp_portal';
  static const _nextStepKey = 'asp_next_step';
  static const _userKey = 'asp_user';
  static const _expiresInKey = 'asp_expires_in';

  // Refresh slightly before the actual JWT expiry.
  // This protects against clock skew and requests crossing the expiry boundary.
  static const Duration _refreshSkew = Duration(minutes: 2);

  // All AuthSessionStore instances share one refresh operation.
  // If Wallet + Notifications + Profile load together, only ONE refresh
  // request is sent to the backend.
  static Future<StoredAuthSession?>? _refreshInFlight;

  final FlutterSecureStorage _storage;
  final http.Client? _refreshClient;

  Future<void> save(VerifyOtpResult result) async {
    final accessToken = result.accessToken.trim();
    final refreshToken = result.refreshToken.trim();

    // A production authenticated session must always be complete.
    // Never keep an older refresh token when a new login is incomplete.
    if (accessToken.isEmpty || refreshToken.isEmpty) {
      await clear();

      throw StateError('Authentication server returned an incomplete session.');
    }

    final values = <String, String>{
      _accessTokenKey: accessToken,
      _refreshTokenKey: refreshToken,
      _roleKey: result.role.trim(),
      _portalKey: result.portal.trim(),
      _nextStepKey: result.nextStep.trim(),
      _userKey: jsonEncode(result.user),
      _expiresInKey: result.expiresIn.toString(),
    };

    // Login is a complete session replacement.
    // This prevents tokens from an older login/account/session
    // surviving a fresh OTP authentication.
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _roleKey),
      _storage.delete(key: _portalKey),
      _storage.delete(key: _nextStepKey),
      _storage.delete(key: _userKey),
      _storage.delete(key: _expiresInKey),
    ]);

    for (final entry in values.entries) {
      await _storage.write(key: entry.key, value: entry.value);
    }
  }

  /// Reads the current session and transparently refreshes Supabase JWTs
  /// that are expired or close to expiry.
  ///
  /// Callers continue using the same AuthSessionStore.read() API.
  Future<StoredAuthSession?> read() async {
    final session = await _readRaw();

    if (session == null) {
      return null;
    }

    if (!_shouldRefresh(session)) {
      return session;
    }

    // Do not destroy a locally stored session because of a temporary
    // network problem. A rejected/revoked refresh token is handled
    // separately inside _refreshFromServer.
    try {
      return await _refreshSingleFlight(session);
    } catch (_) {
      return await _readRaw();
    }
  }

  /// Used by API layers when the server explicitly returns 401.
  /// It is safe to call concurrently; only one refresh happens.
  Future<StoredAuthSession?> forceRefresh() async {
    final session = await _readRaw();

    if (session == null || session.refreshToken.trim().isEmpty) {
      return null;
    }

    return _refreshSingleFlight(session);
  }

  Future<StoredAuthSession?> _readRaw() async {
    final accessToken = await _storage.read(key: _accessTokenKey);

    if (accessToken == null || accessToken.trim().isEmpty) {
      return null;
    }

    final refreshToken = await _storage.read(key: _refreshTokenKey) ?? '';
    final role = await _storage.read(key: _roleKey) ?? '';
    final portal = await _storage.read(key: _portalKey) ?? '';
    final nextStep = await _storage.read(key: _nextStepKey) ?? '';
    final userSource = await _storage.read(key: _userKey) ?? '{}';
    final expiresInSource = await _storage.read(key: _expiresInKey) ?? '0';

    return StoredAuthSession(
      accessToken: accessToken.trim(),
      refreshToken: refreshToken.trim(),
      role: role,
      portal: portal,
      nextStep: nextStep,
      user: _decodeUser(userSource),
      expiresIn: int.tryParse(expiresInSource) ?? 0,
    );
  }

  bool _shouldRefresh(StoredAuthSession session) {
    if (session.refreshToken.trim().isEmpty) {
      return false;
    }

    final expiresAt = _readJwtExpiry(session.accessToken);

    // Development local tokens are intentionally not JWTs.
    if (expiresAt == null) {
      return false;
    }

    final refreshAt = DateTime.now().toUtc().add(_refreshSkew);

    return !expiresAt.isAfter(refreshAt);
  }

  DateTime? _readJwtExpiry(String token) {
    try {
      final parts = token.split('.');

      if (parts.length != 3) {
        return null;
      }

      final payloadBytes = base64Url.decode(base64Url.normalize(parts[1]));

      final payload = jsonDecode(utf8.decode(payloadBytes));

      if (payload is! Map) {
        return null;
      }

      final rawSub = payload['sub']?.toString().trim();
      if (rawSub != null && rawSub.isNotEmpty) {
        debugPrint('AI_AUTH_SUB=$rawSub');
      }

      final rawExp = payload['exp'];
      final exp = rawExp is int
          ? rawExp
          : int.tryParse(rawExp?.toString() ?? '');

      if (exp == null || exp <= 0) {
        return null;
      }

      return DateTime.fromMillisecondsSinceEpoch(exp * 1000, isUtc: true);
    } catch (_) {
      return null;
    }
  }

  Future<StoredAuthSession?> _refreshSingleFlight(
    StoredAuthSession current,
  ) async {
    final activeRefresh = _refreshInFlight;

    if (activeRefresh != null) {
      return activeRefresh;
    }

    final task = _refreshFromServer(current);
    _refreshInFlight = task;

    try {
      return await task;
    } finally {
      if (identical(_refreshInFlight, task)) {
        _refreshInFlight = null;
      }
    }
  }

  Future<StoredAuthSession?> _refreshFromServer(
    StoredAuthSession current,
  ) async {
    final refreshToken = current.refreshToken.trim();

    if (refreshToken.isEmpty) {
      return current;
    }

    final ownsClient = _refreshClient == null;
    final client = _refreshClient ?? http.Client();

    try {
      final response = await client
          .post(
            Uri.parse('${ApiConfig.baseUrl}/auth/refresh'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({
              'refreshToken': refreshToken,
              'portal': current.portal.trim().isEmpty
                  ? 'customer'
                  : current.portal.trim(),
            }),
          )
          .timeout(ApiConfig.requestTimeout);

      final body = _decodeBody(response.body);

      if (response.statusCode == 401 || response.statusCode == 403) {
        // Refresh token is revoked/expired, or account access was revoked.
        // Only now is the local login state removed.
        await clear();
        return null;
      }

      if (response.statusCode < 200 ||
          response.statusCode >= 300 ||
          body['success'] != true) {
        throw StateError('Session refresh request failed');
      }

      final rawSession = body['session'];

      if (rawSession is! Map) {
        throw StateError('Invalid session refresh response');
      }

      final session = Map<String, dynamic>.from(rawSession);

      final newAccessToken =
          body['accessToken']?.toString().trim().isNotEmpty == true
          ? body['accessToken'].toString().trim()
          : session['accessToken']?.toString().trim() ?? '';

      final newRefreshToken =
          session['refreshToken']?.toString().trim().isNotEmpty == true
          ? session['refreshToken'].toString().trim()
          : refreshToken;

      final expiresIn =
          int.tryParse(session['expiresIn']?.toString() ?? '') ??
          current.expiresIn;

      if (newAccessToken.isEmpty || newRefreshToken.isEmpty) {
        throw StateError('Incomplete refreshed session');
      }

      // Refresh tokens may rotate.
      // Store the new refresh token first so an app interruption cannot
      // leave us with only an already-consumed old refresh token.
      await _storage.write(key: _refreshTokenKey, value: newRefreshToken);

      await _storage.write(key: _accessTokenKey, value: newAccessToken);

      await _storage.write(key: _expiresInKey, value: expiresIn.toString());

      return StoredAuthSession(
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        role: current.role,
        portal: current.portal,
        nextStep: current.nextStep,
        user: current.user,
        expiresIn: expiresIn,
      );
    } finally {
      if (ownsClient) {
        client.close();
      }
    }
  }

  Future<void> clear() async {
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _roleKey),
      _storage.delete(key: _portalKey),
      _storage.delete(key: _nextStepKey),
      _storage.delete(key: _userKey),
      _storage.delete(key: _expiresInKey),
    ]);
  }

  Map<String, dynamic> _decodeUser(String source) {
    try {
      final decoded = jsonDecode(source);

      if (decoded is Map<String, dynamic>) {
        return decoded;
      }

      if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
    } catch (_) {
      // Corrupt optional user metadata must not destroy a valid session.
    }

    return <String, dynamic>{};
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
    } catch (_) {}

    return <String, dynamic>{};
  }
}

class StoredAuthSession {
  const StoredAuthSession({
    required this.accessToken,
    required this.refreshToken,
    required this.role,
    required this.portal,
    required this.nextStep,
    required this.user,
    required this.expiresIn,
  });

  final String accessToken;
  final String refreshToken;
  final String role;
  final String portal;
  final String nextStep;
  final Map<String, dynamic> user;
  final int expiresIn;
}
