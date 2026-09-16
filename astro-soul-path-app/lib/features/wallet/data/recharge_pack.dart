class RechargePack {
  const RechargePack({
    required this.id,
    required this.amount,
    required this.bonusPercent,
    required this.bonusAmount,
    required this.creditAmount,
    required this.label,
  });

  final String id;
  final double amount;
  final double bonusPercent;
  final double bonusAmount;
  final double creditAmount;
  final String? label;

  factory RechargePack.fromJson(Map<String, dynamic> json) {
    return RechargePack(
      id: (json['id'] ?? '').toString(),
      amount: _asDouble(json['amount']),
      bonusPercent: _asDouble(json['bonusPercent']),
      bonusAmount: _asDouble(json['bonusAmount']),
      creditAmount: _asDouble(json['creditAmount']),
      label: _asNullableString(json['label']),
    );
  }

  static double _asDouble(dynamic value) {
    if (value is num) {
      return value.toDouble();
    }

    return double.tryParse(value?.toString() ?? '') ?? 0;
  }

  static String? _asNullableString(dynamic value) {
    if (value == null) {
      return null;
    }

    final text = value.toString().trim();

    return text.isEmpty ? null : text;
  }
}
