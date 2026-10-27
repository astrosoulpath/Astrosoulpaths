/// An authoritative provider order. Never rounds money or assumes a currency.
class CheckoutOrder {
  const CheckoutOrder._(this.id, this.amount, this.currency);
  final String id;
  final int amount;
  final String currency;

  factory CheckoutOrder.fromServer(Map<String, dynamic> order) {
    final id = order['id'];
    final rawAmount = order['amount'];
    final amount = rawAmount is int
        ? rawAmount
        : rawAmount is String && RegExp(r'^[0-9]+$').hasMatch(rawAmount)
        ? int.tryParse(rawAmount)
        : null;
    final rawCurrency = order['currency'];
    final currency = rawCurrency is String
        ? rawCurrency.trim().toUpperCase()
        : '';
    if (id is! String ||
        !RegExp(r'^order_[A-Za-z0-9]+$').hasMatch(id) ||
        amount == null ||
        amount <= 0 ||
        amount > 9007199254740991 ||
        !RegExp(r'^[A-Z]{3}$').hasMatch(currency)) {
      throw const FormatException('Invalid payment order returned by server.');
    }
    return CheckoutOrder._(id, amount, currency);
  }
}
