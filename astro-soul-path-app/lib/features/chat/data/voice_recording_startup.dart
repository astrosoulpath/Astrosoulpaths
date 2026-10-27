/// Serializes recorder startup and fences permission/native initialization races.
class VoiceRecordingStartup {
  int _generation = 0;
  bool _closed = false;
  Future<void>? _pending;
  bool get starting => _pending != null;

  void cancel() => _generation++;

  Future<void> run(
    Future<void> Function(bool Function() isCurrent) action, {
    required Future<void> Function() cancelRecorder,
  }) {
    if (_closed || starting) return Future.value();
    final generation = ++_generation;
    bool current() => !_closed && generation == _generation;
    return _pending = (() async {
      try {
        await action(current);
      } finally {
        if (!current()) {
          try {
            await cancelRecorder();
          } catch (_) {
            /* Best effort native cleanup. */
          }
        }
      }
    })().whenComplete(() => _pending = null);
  }

  Future<void> close(Future<void> Function() disposeRecorder) async {
    _closed = true;
    cancel();
    try {
      await _pending;
    } finally {
      await disposeRecorder();
    }
  }
}
