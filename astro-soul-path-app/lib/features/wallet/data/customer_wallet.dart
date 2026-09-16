class CustomerWallet {
  const CustomerWallet({
    required this.id,
    required this.balance,
    required this.paidBalance,
    required this.freeBalance,
    required this.lockedBalance,
    required this.availableBalance,
    required this.currency,
  });

  factory CustomerWallet.fromJson(Map<String, dynamic> json) {
    return CustomerWallet(
      id: json['id']?.toString().trim() ?? '',
      balance: _readAmount(json['balance']),
      paidBalance: _readAmount(json['paidBalance']),
      freeBalance: _readAmount(json['freeBalance']),
      lockedBalance: _readAmount(json['lockedBalance']),
      availableBalance: _readAmount(json['availableBalance']),
      currency: json['currency']?.toString().trim().isNotEmpty == true
          ? json['currency'].toString().trim()
          : 'INR',
    );
  }

  final String id;
  final double balance;
  final double paidBalance;
  final double freeBalance;
  final double lockedBalance;
  final double availableBalance;
  final String currency;

  String get availableBalanceLabel =>
      'Ã¢â€šÂ¹${_formatAmount(availableBalance)}';

  String get totalBalanceLabel => 'Ã¢â€šÂ¹${_formatAmount(balance)}';

  String get lockedBalanceLabel => 'Ã¢â€šÂ¹${_formatAmount(lockedBalance)}';

  bool canAfford(double amount) {
    return amount >= 0 && availableBalance >= amount;
  }

  static double _readAmount(Object? value) {
    final amount = value is num
        ? value.toDouble()
        : double.tryParse(value?.toString() ?? '') ?? 0;

    return amount < 0 ? 0 : amount;
  }

  static String _formatAmount(double value) {
    return value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(2);
  }
}
