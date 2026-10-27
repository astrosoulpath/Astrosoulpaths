/// Presentation only. Backend remains authoritative for totals and settlement.
String marketplaceMoney(dynamic value, String currency) {
  final code = currency.trim().toUpperCase();
  final raw = value?.toString().trim() ?? '';
  final match = RegExp(r'^(-?)(\d+)(?:\.(\d{1,2}))?$').firstMatch(raw);
  if (!RegExp(r'^[A-Z]{3}$').hasMatch(code) || match == null) {
    return 'Unavailable';
  }
  return '$code ${match[1]}${match[2]}.${(match[3] ?? '').padRight(2, '0')}';
}
