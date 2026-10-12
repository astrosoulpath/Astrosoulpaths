// ignore_for_file: prefer_initializing_formals

import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../../../core/config/api_config.dart';
import 'auth_api.dart';

class AuthSessionStore {
  AuthSessionStore({
    FlutterSecureStorage? storage,
    http.Client? refreshClient,
    Future<String?> Function(bool forceRefresh)? firebaseTokenLoader,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _refreshClient = refreshClient,
       _firebaseTokenLoader = firebaseTokenLoader;

  static const _accessTokenKey = 'asp_access_token';
  static const _refreshTokenKey = 'asp_refresh_token';
  static const _roleKey = 'asp_role';
  static const _portalKey = 'asp_portal';
  static const _nextStepKey = 'asp_next_step';
  static const _userKey = 'asp_user';
  static const _expiresInKey = 'asp_expires_in';
  static const _authProviderKey = 'asp_auth_provider';

  // Refresh slightly before the actual JWT expiry.
  // This protects against clock skew and requests crossing the expiry boundary.
  static const Duration _refreshSkew = Duration(minutes: 2);

  // All AuthSessionStore instances share one refresh operation.
  // If Wallet + Notifications + Profile load together, only ONE refresh
  // request is sent to the backend.
  static Future<StoredAuthSession?>? _refreshInFlight;
  static String? _refreshInFlightKey;

  final FlutterSecureStorage _storage;
  final http.Client? _refreshClient;
  final Future<String?> Function(bool)? _firebaseTokenLoader;

  Future<void> save(VerifyOtpResult result) async {
    final accessToken = result.accessToken.trim();
    final refreshToken = result.refreshToken.trim();

    final authProvider =
        result.session['authProvider']?.toString().trim().toLowerCase() ??
        'supabase';

    final isFirebase = authProvider == 'firebase';

    if (accessToken.isEmpty || (!isFirebase && refreshToken.isEmpty)) {
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
      _authProviderKey: authProvider,
    };

    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
      _storage.delete(key: _roleKey),
      _storage.delete(key: _portalKey),
      _storage.delete(key: _nextStepKey),
      _storage.delete(key: _userKey),
      _storage.delete(key: _expiresInKey),
      _storage.delete(key: _authProviderKey),
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

    if (session == null) {
      return null;
    }

    if (session.authProvider != 'firebase' &&
        session.refreshToken.trim().isEmpty) {
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
    final authProvider =
        await _storage.read(key: _authProviderKey) ?? 'supabase';

    return StoredAuthSession(
      accessToken: accessToken.trim(),
      refreshToken: refreshToken.trim(),
      role: role,
      portal: portal,
      nextStep: nextStep,
      user: _decodeUser(userSource),
      expiresIn: int.tryParse(expiresInSource) ?? 0,
      authProvider: authProvider,
    );
  }

  bool _shouldRefresh(StoredAuthSession session) {
    if (session.authProvider != 'firebase' &&
        session.refreshToken.trim().isEmpty) {
      return false;
    }

    final expiresAt = _readJwtExpiry(session.accessToken);

    // Development local tokens are intentionally not JWTs.
    if (expiresAt == null) {
      return session.authProvider == 'firebase';
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

  Future<StoredAuthSession?> _refreshFirebaseSession(
    StoredAuthSession current,
  ) async {
    String? token;
    try {
      if (_firebaseTokenLoader != null) {
        token = await _firebaseTokenLoader(true);
      } else {
        final user = FirebaseAuth.instance.currentUser;
        if (user == null || user.uid != _jwtSubject(current.accessToken)) {
          await clear();
          return null;
        }
        token = await user.getIdToken(true);
        if (FirebaseAuth.instance.currentUser?.uid != user.uid) {
          await clear();
          return null;
        }
      }
    } on FirebaseAuthException catch (error) {
      if (const {
        'user-disabled',
        'user-token-expired',
        'invalid-user-token',
        'user-not-found',
      }.contains(error.code)) {
        await clear();
        return null;
      }
      rethrow;
    }
    if (token == null ||
        token.trim().isEmpty ||
        _jwtSubject(current.accessToken) == null ||
        _jwtSubject(token) != _jwtSubject(current.accessToken)) {
      await clear();
      return null;
    }

    final normalizedToken = token.trim();

    await _storage.write(key: _accessTokenKey, value: normalizedToken);

    await _storage.write(key: _authProviderKey, value: 'firebase');

    return StoredAuthSession(
      accessToken: normalizedToken,
      refreshToken: '',
      role: current.role,
      portal: current.portal,
      nextStep: current.nextStep,
      user: current.user,
      expiresIn: current.expiresIn,
      authProvider: 'firebase',
    );
  }

  Future<StoredAuthSession?> _refreshSingleFlight(
    StoredAuthSession current,
  ) async {
    final activeRefresh = _refreshInFlight;

    final refreshKey = [
      current.authProvider,
      _jwtSubject(current.accessToken) ?? current.accessToken,
      current.portal,
    ].join(':');
    if (activeRefresh != null && _refreshInFlightKey == refreshKey) {
      return activeRefresh;
    }

    final task = current.authProvider == 'firebase'
        ? _refreshFirebaseSession(current)
        : _refreshFromServer(current);
    _refreshInFlight = task;
    _refreshInFlightKey = refreshKey;

    try {
      return await task;
    } finally {
      if (identical(_refreshInFlight, task)) {
        _refreshInFlight = null;
        _refreshInFlightKey = null;
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

  String? _jwtSubject(String token) {
    try {
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(token.split('.')[1]))),
      );
      return payload is Map ? payload['sub']?.toString() : null;
    } catch (_) {
      return null;
    }
  }

  Future<StoredAuthSession?> restore({
    String? portal,
    bool persist = true,
  }) async {
    final raw = await _readRaw();
    if (raw == null) return null;
    final current = raw.authProvider == 'firebase'
        ? await forceRefresh()
        : await read();
    if (current == null) return null;
    final ownsClient = _refreshClient == null;
    final client = _refreshClient ?? http.Client();
    try {
      final response = await client
          .get(
            Uri.parse(
              '${ApiConfig.baseUrl}/user/session',
            ).replace(queryParameters: {'portal': portal ?? current.portal}),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer ${current.accessToken}',
            },
          )
          .timeout(ApiConfig.requestTimeout);
      if (response.statusCode == 401 || response.statusCode == 403) {
        await clear();
        return null;
      }
      final body = _decodeBody(response.body);
      if (response.statusCode != 200 ||
          body['success'] != true ||
          body['user'] is! Map ||
          body['role'] is! String ||
          body['portal'] is! String ||
          body['nextStep'] is! String) {
        throw StateError(
          'Unable to verify current account access. Please retry.',
        );
      }
      final user = Map<String, dynamic>.from(body['user'] as Map);
      if (current.user['id'] == null || current.user['id'] != user['id']) {
        await clear();
        throw StateError('Account identity changed. Please sign in again.');
      }
      final restored = StoredAuthSession(
        accessToken: current.accessToken,
        refreshToken: current.refreshToken,
        role: body['role'] as String,
        portal: body['portal'] as String,
        nextStep: body['nextStep'] as String,
        user: user,
        expiresIn: current.expiresIn,
        authProvider: current.authProvider,
      );
      if (persist) {
        await _storage.write(key: _roleKey, value: restored.role);
        await _storage.write(key: _portalKey, value: restored.portal);
        await _storage.write(key: _nextStepKey, value: restored.nextStep);
        await _storage.write(key: _userKey, value: jsonEncode(restored.user));
      }
      return restored;
    } finally {
      if (ownsClient) client.close();
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
      _storage.delete(key: _authProviderKey),
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
    this.authProvider = 'supabase',
  });

  final String accessToken;
  final String refreshToken;
  final String role;
  final String portal;
  final String nextStep;
  final Map<String, dynamic> user;
  final int expiresIn;
  final String authProvider;
}
