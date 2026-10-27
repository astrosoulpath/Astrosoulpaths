enum MarketplacePaymentState { confirmed, cancelled, pending }

MarketplacePaymentState marketplacePaymentState(Map<String, dynamic> order) {
  final verified = DateTime.tryParse(
    order['paymentVerifiedAt']?.toString() ?? '',
  );
  if (verified != null &&
      ['CONFIRMED', 'PROCESSING', 'COMPLETED'].contains(order['status'])) {
    return MarketplacePaymentState.confirmed;
  }
  if (verified == null && order['status'] == 'CANCELLED') {
    return MarketplacePaymentState.cancelled;
  }
  return MarketplacePaymentState.pending;
}
