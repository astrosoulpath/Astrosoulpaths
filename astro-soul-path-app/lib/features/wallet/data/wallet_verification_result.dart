/// A native Checkout callback is not payment proof. Only an explicit successful
/// backend reconciliation may drive the wallet success dialog or clear recovery.
String walletVerificationStatus(Map<String, dynamic> result) {
  final status = result['status'];
  if (result['success'] != true ||
      status is! String ||
      !const {'SUCCESS', 'PENDING', 'FAILED'}.contains(status)) {
    throw const FormatException(
      'Payment verification is incomplete. Check payment status before retrying.',
    );
  }
  return status.toLowerCase();
}
