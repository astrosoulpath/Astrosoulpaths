import '../../profile/data/customer_profile.dart';
import 'auth_session_store.dart';

/// Server completion is authoritative; a dismissed form never completes it.
Future<bool> completeCustomerOnboarding({
  required AuthSessionStore sessions,
  required Future<List<CustomerProfile>> Function() loadProfiles,
  required Future<bool?> Function(CustomerProfile?) showForm,
}) async {
  final revision = AuthSessionStore.sessionRevision;
  final session = await sessions.restore(portal: 'customer');
  if (session == null ||
      session.portal != 'customer' ||
      revision != AuthSessionStore.sessionRevision) {
    return false;
  }
  if (session.user['isProfileComplete'] == true) return true;
  final profiles = await loadProfiles();
  if (revision != AuthSessionStore.sessionRevision) return false;
  if (await showForm(profiles.isEmpty ? null : profiles.first) != true) {
    return false;
  }
  final refreshed = await sessions.restore(portal: 'customer');
  return revision == AuthSessionStore.sessionRevision &&
      refreshed != null &&
      refreshed.portal == 'customer' &&
      refreshed.user['id'] == session.user['id'] &&
      refreshed.user['isProfileComplete'] == true;
}
