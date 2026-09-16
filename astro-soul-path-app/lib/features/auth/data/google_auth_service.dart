import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/supabase_config.dart';

class GoogleAuthCancelledException implements Exception {
  const GoogleAuthCancelledException();
}

class GoogleAuthException implements Exception {
  const GoogleAuthException(this.message);

  final String message;

  @override
  String toString() => message;
}

class GoogleAuthResult {
  const GoogleAuthResult({
    required this.user,
    required this.session,
    required this.googleEmail,
    required this.googleName,
    required this.googlePhotoUrl,
  });

  final User user;
  final Session session;
  final String googleEmail;
  final String? googleName;
  final String? googlePhotoUrl;
}

class GoogleAuthService {
  GoogleAuthService._();

  static final GoogleAuthService instance = GoogleAuthService._();

  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;

  bool _initialized = false;

  static const List<String> _scopes = <String>['email', 'profile'];

  Future<void> initialize() async {
    if (_initialized) {
      return;
    }

    SupabaseConfig.validate();

    await _googleSignIn.initialize(
      clientId: !kIsWeb && Platform.isIOS
          ? _optional(SupabaseConfig.googleIosClientId)
          : null,
      // Android reads the Web OAuth client from google-services.json
      // via the generated default_web_client_id resource.
      // Supplying it again manually can create configuration drift.
      serverClientId: !kIsWeb && Platform.isAndroid
          ? null
          : SupabaseConfig.googleWebClientId,
    );

    _initialized = true;
  }

  Future<GoogleAuthResult> signIn() async {
    await initialize();

    if (kIsWeb) {
      throw const GoogleAuthException(
        'This Google button currently supports Android and iOS native login.',
      );
    }

    if (!_googleSignIn.supportsAuthenticate()) {
      throw const GoogleAuthException(
        'Google Sign-In is not supported on this device.',
      );
    }

    try {
      final GoogleSignInAccount googleUser = await _googleSignIn.authenticate();

      final GoogleSignInAuthentication authentication =
          googleUser.authentication;

      final String? idToken = authentication.idToken;

      if (idToken == null || idToken.trim().isEmpty) {
        throw const GoogleAuthException('Google did not return an ID token.');
      }

      GoogleSignInClientAuthorization? authorization = await googleUser
          .authorizationClient
          .authorizationForScopes(_scopes);

      authorization ??= await googleUser.authorizationClient.authorizeScopes(
        _scopes,
      );

      final String accessToken = authorization.accessToken.trim();

      if (accessToken.isEmpty) {
        throw const GoogleAuthException(
          'Google did not return an access token.',
        );
      }

      final AuthResponse response = await Supabase.instance.client.auth
          .signInWithIdToken(
            provider: OAuthProvider.google,
            idToken: idToken,
            accessToken: accessToken,
          );

      final User? user = response.user;
      final Session? session = response.session;

      if (user == null || session == null) {
        throw const GoogleAuthException(
          'Google authentication did not create a valid session.',
        );
      }

      return GoogleAuthResult(
        user: user,
        session: session,
        googleEmail: googleUser.email,
        googleName: googleUser.displayName,
        googlePhotoUrl: googleUser.photoUrl,
      );
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw const GoogleAuthCancelledException();
      }

      throw GoogleAuthException(error.description ?? 'Google sign-in failed.');
    } on AuthException catch (error) {
      throw GoogleAuthException(error.message);
    } on GoogleAuthException {
      rethrow;
    } catch (_) {
      throw const GoogleAuthException(
        'Unable to sign in with Google. Please try again.',
      );
    }
  }

  Future<void> signOut() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {
      // Continue so Google account state is also cleared.
    }

    try {
      await _googleSignIn.signOut();
    } catch (_) {
      // Sign out is best-effort.
    }
  }

  static String? _optional(String value) {
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }
}
