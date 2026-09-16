class WalletTransaction {
  const WalletTransaction({
    required this.id,
    required this.type,
    required this.ledgerType,
    required this.title,
    required this.amount,
    required this.balanceBefore,
    required this.balanceAfter,
    required this.referenceType,
    required this.referenceId,
    required this.createdAt,
  });

  factory WalletTransaction.fromJson(Map<String, dynamic> json) {
    return WalletTransaction(
      id: _readString(json['id']),
      type: _readString(json['type']).toLowerCase(),
      ledgerType: _readString(json['ledgerType']),
      title: _readString(json['title']).isEmpty
          ? 'Wallet transaction'
          : _readString(json['title']),
      amount: _readAmount(json['amount']),
      balanceBefore: _readAmount(json['balanceBefore']),
      balanceAfter: _readAmount(json['balanceAfter']),
      referenceType: _readString(json['referenceType']),
      referenceId: _readString(json['referenceId']),
      createdAt: DateTime.tryParse(
        json['createdAt']?.toString() ?? json['date']?.toString() ?? '',
      ),
    );
  }

  final String id;
  final String type;
  final String ledgerType;
  final String title;
  final double amount;
  final double balanceBefore;
  final double balanceAfter;
  final String referenceType;
  final String referenceId;
  final DateTime? createdAt;

  bool get isCredit => type == 'credit';

  static String _readString(Object? value) => value?.toString().trim() ?? '';

  static double _readAmount(Object? value) {
    return value is num
        ? value.toDouble()
        : double.tryParse(value?.toString() ?? '') ?? 0;
  }
}
