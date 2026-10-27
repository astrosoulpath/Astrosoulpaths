import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'auth_session_store.dart';
import 'google_auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/notifications/notification_service.dart';

/// Explicit logout is distinct from clearing a rejected cached session.
Future<void> secureLogout(
  AuthSessionStore sessions, {
  Future<void> Function()? signOutFirebase,
  Future<void> Function()? signOutGoogle,
  Future<void> Function()? signOutLegacy,
  Future<void> Function()? unbindNotifications,
}) async {
  Object? failure;
  try {
    await (unbindNotifications ??
        () => NotificationService.instance.unbindCurrentDevice(sessions))();
  } catch (error) {
    failure = error;
  }
  try {
    await sessions.clear();
  } catch (error) {
    failure = error;
  }
  for (final operation in [
    signOutFirebase ??
        () async {
          Object? firebaseFailure;
          for (final app in Firebase.apps) {
            try {
              await FirebaseAuth.instanceFor(app: app).signOut();
            } catch (error) {
              firebaseFailure ??= error;
            }
          }
          if (firebaseFailure != null) {
            throw StateError('Firebase sign-out could not be confirmed.');
          }
        },
    signOutGoogle ??
        () async {
          await GoogleAuthService.instance.initialize();
          await GoogleSignIn.instance.signOut();
        },
    signOutLegacy ??
        () async {
          if (Supabase.instance.client.auth.currentSession != null) {
            await Supabase.instance.client.auth.signOut(
              scope: SignOutScope.local,
            );
          }
        },
  ]) {
    try {
      await operation();
    } catch (error) {
      failure ??= error;
    }
  }
  try {
    await sessions.clear();
  } catch (error) {
    failure ??= error;
  }
  if (failure != null) {
    throw StateError(
      'Complete sign-out could not be confirmed. Please retry logout.',
    );
  }
}
