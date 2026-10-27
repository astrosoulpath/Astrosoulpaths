import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart' as firebase;
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/config/supabase_config.dart';

class GoogleAuthCancelledException implements Exception {
  const GoogleAuthCancelledException();
}

/// User-initiated login must show account selection, not reuse native selection.
/// Does not revoke access or modify a Firebase user/identity mapping.
Future<T> selectGoogleAccount<T>({
  required Future<void> Function() signOutSelection,
  required Future<T> Function() authenticate,
}) async {
  await signOutSelection();
  return authenticate();
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
    required this.firebaseIdToken,
    required this.googleEmail,
    required this.googleName,
    required this.googlePhotoUrl,
    required this.googleIdToken,
    required this.googleAccessToken,
  });

  final firebase.User user;
  final String firebaseIdToken;
  final String googleEmail;
  final String? googleName;
  final String? googlePhotoUrl;
  final String googleIdToken;
  final String googleAccessToken;
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
      final GoogleSignInAccount googleUser = await selectGoogleAccount(
        signOutSelection: _googleSignIn.signOut,
        authenticate: _googleSignIn.authenticate,
      );

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

      final credential = firebase.GoogleAuthProvider.credential(
        idToken: idToken,
        accessToken: accessToken,
      );
      final userCredential = await firebase.FirebaseAuth.instance
          .signInWithCredential(credential);
      final user = userCredential.user;

      if (user == null) {
        throw const GoogleAuthException(
          'Firebase did not create a valid Google session.',
        );
      }

      final firebaseIdToken = await user.getIdToken(true);

      if (firebaseIdToken == null || firebaseIdToken.trim().isEmpty) {
        throw const GoogleAuthException(
          'Firebase did not return an authentication token.',
        );
      }

      return GoogleAuthResult(
        user: user,
        firebaseIdToken: firebaseIdToken.trim(),
        googleEmail: googleUser.email,
        googleName: googleUser.displayName,
        googlePhotoUrl: googleUser.photoUrl,
        googleIdToken: idToken,
        googleAccessToken: accessToken,
      );
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw const GoogleAuthCancelledException();
      }

      throw GoogleAuthException(error.description ?? 'Google sign-in failed.');
    } on firebase.FirebaseAuthException catch (error) {
      throw GoogleAuthException(
        error.code == 'account-exists-with-different-credential'
            ? 'This Google account is already registered with another sign-in method. Sign in to that account to link Google securely.'
            : 'Firebase Google sign-in failed. Please try again.',
      );
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
      await firebase.FirebaseAuth.instance.signOut();
    } catch (_) {
      // Continue so the Google account state is also cleared.
    }

    try {
      await _googleSignIn.signOut();
    } catch (_) {
      // Sign out is best-effort.
    }
  }

  Future<GoogleAuthResult> linkGoogleToCurrentEmailAccount() async {
    final existingUser = firebase.FirebaseAuth.instance.currentUser;

    if (existingUser == null || !existingUser.emailVerified) {
      throw const GoogleAuthException(
        'Sign in with your verified email account before linking Google.',
      );
    }

    if (existingUser.providerData.any(
      (provider) => provider.providerId == 'google.com',
    )) {
      final token = await existingUser.getIdToken(true);
      if (token == null || token.trim().isEmpty) {
        throw const GoogleAuthException(
          'Firebase did not return an authentication token.',
        );
      }
      return GoogleAuthResult(
        user: existingUser,
        firebaseIdToken: token.trim(),
        googleEmail: existingUser.email ?? '',
        googleName: existingUser.displayName,
        googlePhotoUrl: existingUser.photoURL,
        googleIdToken: '',
        googleAccessToken: '',
      );
    }

    final GoogleSignInAccount googleUser;
    try {
      googleUser = await _googleSignIn.authenticate();
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) {
        throw const GoogleAuthCancelledException();
      }
      throw GoogleAuthException(error.description ?? 'Google sign-in failed.');
    }

    if (googleUser.email.trim().toLowerCase() !=
        existingUser.email?.trim().toLowerCase()) {
      throw const GoogleAuthException(
        'The Google email differs from this account. Linking is blocked to protect your account data; contact support for review.',
      );
    }

    final googleIdToken = googleUser.authentication.idToken;
    if (googleIdToken == null || googleIdToken.trim().isEmpty) {
      throw const GoogleAuthException('Google did not return an ID token.');
    }

    final authorization =
        await googleUser.authorizationClient.authorizationForScopes(_scopes) ??
        await googleUser.authorizationClient.authorizeScopes(_scopes);
    final googleAccessToken = authorization.accessToken.trim();

    if (googleAccessToken.isEmpty) {
      throw const GoogleAuthException('Google did not return an access token.');
    }

    final credential = firebase.GoogleAuthProvider.credential(
      idToken: googleIdToken,
      accessToken: googleAccessToken,
    );

    firebase.User linkedUser;
    try {
      final linkedCredential = await existingUser.linkWithCredential(
        credential,
      );
      final user = linkedCredential.user;
      if (user == null) {
        throw const GoogleAuthException(
          'Firebase did not return the linked account.',
        );
      }
      linkedUser = user;
    } on firebase.FirebaseAuthException catch (error) {
      if (error.code == 'credential-already-in-use' ||
          error.code == 'account-exists-with-different-credential') {
        throw const GoogleAuthException(
          'This Google sign-in is already attached to another account. Contact support to review the accounts; no data was merged.',
        );
      }
      if (error.code == 'provider-already-linked') {
        await existingUser.reload();
        linkedUser = firebase.FirebaseAuth.instance.currentUser ?? existingUser;
      } else {
        throw GoogleAuthException(
          'Google could not be linked to this email account. Please try again.',
        );
      }
    }

    if (!linkedUser.providerData.any(
      (provider) => provider.providerId == 'google.com',
    )) {
      throw const GoogleAuthException(
        'Firebase did not confirm the Google provider link.',
      );
    }

    final firebaseIdToken = await linkedUser.getIdToken(true);
    if (firebaseIdToken == null || firebaseIdToken.trim().isEmpty) {
      throw const GoogleAuthException(
        'Firebase did not return an authentication token.',
      );
    }

    return GoogleAuthResult(
      user: linkedUser,
      firebaseIdToken: firebaseIdToken.trim(),
      googleEmail: googleUser.email,
      googleName: googleUser.displayName,
      googlePhotoUrl: googleUser.photoUrl,
      googleIdToken: googleIdToken,
      googleAccessToken: googleAccessToken,
    );
  }

  Future<Session?> signInToLegacySupabase({
    required String googleIdToken,
    required String googleAccessToken,
  }) async {
    try {
      final response = await Supabase.instance.client.auth.signInWithIdToken(
        provider: OAuthProvider.google,
        idToken: googleIdToken,
        accessToken: googleAccessToken,
      );

      return response.session;
    } on AuthException catch (error) {
      throw GoogleAuthException(
        'Legacy account verification failed: ${error.message}',
      );
    } finally {
      await Supabase.instance.client.auth.signOut();
    }
  }

  static String? _optional(String value) {
    final normalized = value.trim();
    return normalized.isEmpty ? null : normalized;
  }
}
