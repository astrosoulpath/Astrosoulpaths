/// A user may have several devices/calls. Never apply another request's signal.
bool matchesCallSignal(dynamic payload, String expectedId) {
  if (payload is! Map || expectedId.trim().isEmpty) return false;
  final ids = ['callId', 'callSessionId', 'consultationId']
      .map((key) => payload[key]?.toString().trim() ?? '')
      .where((id) => id.isNotEmpty)
      .toList();
  return ids.isNotEmpty && ids.every((id) => id == expectedId.trim());
}
