/// Display stored currencies independently; never infer a conversion or currency.
String earningsMoney(dynamic amount, dynamic currency) {
  final value = num.tryParse(amount?.toString() ?? '');
  final code = currency?.toString() ?? '';
  if (value == null ||
      !value.isFinite ||
      !RegExp(r'^[A-Z]{3}$').hasMatch(code)) {
    return 'Unavailable';
  }
  return '$code ${value.toStringAsFixed(2)}';
}

String earningsBuckets(dynamic buckets) {
  if (buckets is! List) return 'Unavailable';
  if (buckets.isEmpty) return 'No earnings';
  return buckets
      .map(
        (row) => row is Map
            ? earningsMoney(row['amount'], row['currency'])
            : 'Unavailable',
      )
      .join(' · ');
}
