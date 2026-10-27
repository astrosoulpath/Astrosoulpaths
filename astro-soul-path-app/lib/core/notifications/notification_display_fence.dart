import 'notification_session_fence.dart';

/// Fences the asynchronous authorization -> OS display -> in-app banner gap.
/// Does not claim to recall notifications already accepted by FCM/the OS.
class NotificationDisplayFence {
  NotificationDisplayFence() : generation = NotificationSessionFence.generation;
  final int generation;
  bool get current =>
      !NotificationSessionFence.suspended &&
      generation == NotificationSessionFence.generation;

  Future<bool> display({
    required Future<bool> Function() authorize,
    required Future<void> Function() show,
    required Future<void> Function() clearStale,
  }) async {
    if (!current || !await authorize() || !current) return false;
    await show();
    if (!current) {
      await clearStale();
      return false;
    }
    return true;
  }
}
