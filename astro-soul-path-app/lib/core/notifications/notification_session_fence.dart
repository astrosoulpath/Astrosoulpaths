/// Shared with authentication storage; no SDK, network or credentials.
class NotificationSessionFence {
  static int generation = 0;
  static bool suspended = false;
  static void invalidate() {
    generation++;
  }

  static void suspend() {
    suspended = true;
    invalidate();
  }

  static void activate() {
    suspended = false;
    invalidate();
  }
}
