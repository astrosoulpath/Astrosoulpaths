import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/subscription/models/subscription_plan.dart';

void main() {
  test(
    'synthetic server INR 3500 yearly quote is displayed without repricing',
    () {
      final plan = SubscriptionPlan.fromJson({
        'name': 'ASTROLOGER_KUNDLI_YEARLY',
        'price': '3500.000',
        'currency': 'INR',
        'durationDays': 365,
        'isActive': true,
      });
      expect(plan.price, 3500);
      expect(plan.priceLabel, '\u20b93500 / year');
    },
  );
  test('server USD 1 / 30-day plan is displayed as a fixed period', () {
    final plan = SubscriptionPlan.fromJson({
      'id': 'synthetic-plan',
      'name': 'DAILY_HOROSCOPE_MONTHLY',
      'price': '1.000',
      'currency': 'USD',
      'durationDays': 30,
      'isActive': true,
    });
    expect(plan.price, 1);
    expect(plan.durationDays, 30);
    expect(plan.priceLabel, '\$1 / 30 days');
  });
  test('existing yearly astrologer plan presentation is preserved', () {
    final plan = SubscriptionPlan.fromJson({
      'name': 'ASTROLOGER_KUNDLI_YEARLY',
      'price': '10',
      'currency': 'USD',
      'durationDays': 365,
    });
    expect(plan.billingLabel, 'year');
  });
}
