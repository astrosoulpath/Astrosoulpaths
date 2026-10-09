import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';

class FirebasePhoneCode {
  const FirebasePhoneCode({required this.verificationId, this.resendToken});

  final String verificationId;
  final int? resendToken;
}

class FirebasePhoneAuthService {
  FirebasePhoneAuthService._();

  static final FirebasePhoneAuthService instance = FirebasePhoneAuthService._();

  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<FirebaseAuth> profileVerificationAuth() async {
    const appName = 'astro-profile-phone-verification';

    FirebaseApp app;

    try {
      app = Firebase.app(appName);
    } catch (_) {
      app = await Firebase.initializeApp(
        name: appName,
        options: Firebase.app().options,
      );
    }

    return FirebaseAuth.instanceFor(app: app);
  }

  Future<String> verifyProfilePhoneCode({
    required String verificationId,
    required String smsCode,
  }) async {
    final auth = await profileVerificationAuth();

    final credential = createPhoneCredential(
      verificationId: verificationId,
      smsCode: smsCode,
    );

    final result = await auth.signInWithCredential(credential);
    final user = result.user;

    if (user == null) {
      throw StateError('Firebase did not verify the phone number.');
    }

    final token = await user.getIdToken(true);

    if (token == null || token.trim().isEmpty) {
      throw StateError('Firebase verification token is missing.');
    }

    return token.trim();
  }

  Future<FirebasePhoneCode> sendProfileCode({
    required String phone,
    int? forceResendingToken,
  }) async {
    final auth = await profileVerificationAuth();
    final completer = Completer<FirebasePhoneCode>();

    await auth.verifyPhoneNumber(
      phoneNumber: phone.trim(),
      timeout: const Duration(seconds: 60),
      forceResendingToken: forceResendingToken,

      verificationCompleted: (_) {
        // Keep profile verification in the explicit OTP flow.
      },

      verificationFailed: (FirebaseAuthException error) {
        if (!completer.isCompleted) {
          completer.completeError(
            FirebaseException(
              plugin: 'firebase_auth',
              code: error.code,
              message: error.message ?? 'Profile OTP could not be sent.',
            ),
          );
        }
      },

      codeSent: (verificationId, resendToken) {
        if (!completer.isCompleted) {
          completer.complete(
            FirebasePhoneCode(
              verificationId: verificationId,
              resendToken: resendToken,
            ),
          );
        }
      },

      codeAutoRetrievalTimeout: (verificationId) {
        if (!completer.isCompleted) {
          completer.complete(
            FirebasePhoneCode(
              verificationId: verificationId,
              resendToken: forceResendingToken,
            ),
          );
        }
      },
    );

    return completer.future;
  }

  Future<FirebasePhoneCode> sendCode({
    required String phone,
    int? forceResendingToken,
  }) async {
    final completer = Completer<FirebasePhoneCode>();

    await _auth.verifyPhoneNumber(
      phoneNumber: phone.trim(),
      timeout: const Duration(seconds: 60),
      forceResendingToken: forceResendingToken,

      verificationCompleted: (_) {
        // Keep the current explicit OTP-screen flow deterministic.
      },

      verificationFailed: (FirebaseAuthException error) {
        if (!completer.isCompleted) {
          completer.completeError(
            FirebaseException(
              plugin: 'firebase_auth',
              code: error.code,
              message: error.message ?? 'OTP could not be sent.',
            ),
          );
        }
      },

      codeSent: (verificationId, resendToken) {
        if (!completer.isCompleted) {
          completer.complete(
            FirebasePhoneCode(
              verificationId: verificationId,
              resendToken: resendToken,
            ),
          );
        }
      },

      codeAutoRetrievalTimeout: (verificationId) {
        if (!completer.isCompleted) {
          completer.complete(
            FirebasePhoneCode(
              verificationId: verificationId,
              resendToken: forceResendingToken,
            ),
          );
        }
      },
    );

    return completer.future;
  }

  PhoneAuthCredential createPhoneCredential({
    required String verificationId,
    required String smsCode,
  }) {
    if (verificationId.trim().isEmpty || smsCode.trim().isEmpty) {
      throw ArgumentError('Verification ID and SMS code are required.');
    }

    return PhoneAuthProvider.credential(
      verificationId: verificationId.trim(),
      smsCode: smsCode.trim(),
    );
  }

  Future<String> verifyCode({
    required String verificationId,
    required String smsCode,
  }) async {
    final credential = PhoneAuthProvider.credential(
      verificationId: verificationId,
      smsCode: smsCode.trim(),
    );

    final result = await _auth.signInWithCredential(credential);
    final user = result.user;

    if (user == null) {
      throw StateError('Firebase did not return an authenticated user.');
    }

    final token = await user.getIdToken(true);

    if (token == null || token.trim().isEmpty) {
      throw StateError('Firebase did not return an ID token.');
    }

    return token.trim();
  }
}
