class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.price,
    required this.currency,
    required this.durationDays,
    required this.isActive,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    return SubscriptionPlan(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      price: double.tryParse(json['price']?.toString() ?? '') ?? 0,
      currency: json['currency']?.toString() ?? 'INR',
      durationDays: int.tryParse(json['durationDays']?.toString() ?? '') ?? 0,
      isActive: json['isActive'] == true,
    );
  }

  final String id;
  final String name;
  final double price;
  final String currency;
  final int durationDays;
  final bool isActive;

  bool get isDailyHoroscope => name == 'DAILY_HOROSCOPE_MONTHLY';

  bool get isAstrologerKundli => name == 'ASTROLOGER_KUNDLI_YEARLY';

  String get displayTitle {
    switch (name) {
      case 'DAILY_HOROSCOPE_MONTHLY':
        return 'Daily Horoscope Premium';
      case 'ASTROLOGER_KUNDLI_YEARLY':
        return 'Kundli Professional';
      default:
        return name
            .replaceAll('_', ' ')
            .toLowerCase()
            .split(' ')
            .map(
              (word) => word.isEmpty
                  ? word
                  : '${word[0].toUpperCase()}${word.substring(1)}',
            )
            .join(' ');
    }
  }

  String get billingLabel {
    if (durationDays >= 365) {
      return 'year';
    }

    if (durationDays >= 28) {
      return 'month';
    }

    return '$durationDays days';
  }

  String get priceLabel {
    final formatted = price == price.roundToDouble()
        ? price.toStringAsFixed(0)
        : price.toStringAsFixed(2);

    switch (currency.toUpperCase()) {
      case 'USD':
        return '\$$formatted / $billingLabel';
      case 'INR':
        return '₹$formatted / $billingLabel';
      default:
        return '${currency.toUpperCase()} $formatted / $billingLabel';
    }
  }
}
