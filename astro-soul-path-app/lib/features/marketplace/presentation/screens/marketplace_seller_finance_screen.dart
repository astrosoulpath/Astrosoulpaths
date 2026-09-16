import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/marketplace_seller_api.dart';

class MarketplaceSellerFinanceScreen extends StatefulWidget {
  const MarketplaceSellerFinanceScreen({super.key});

  @override
  State<MarketplaceSellerFinanceScreen> createState() =>
      _MarketplaceSellerFinanceScreenState();
}

class _MarketplaceSellerFinanceScreenState
    extends State<MarketplaceSellerFinanceScreen> {
  final MarketplaceSellerApi _api = MarketplaceSellerApi();

  bool _loading = true;
  String? _error;
  Map<String, dynamic> _earningData = <String, dynamic>{};
  List<Map<String, dynamic>> _payouts = <Map<String, dynamic>>[];

  String _text(dynamic value) => value?.toString().trim() ?? '';

  List<Map<String, dynamic>> get _earnings {
    final value = _earningData['earnings'];

    if (value is! List) {
      return const <Map<String, dynamic>>[];
    }

    return value
        .whereType<Map>()
        .map(
          (item) => item.map((key, value) => MapEntry(key.toString(), value)),
        )
        .toList(growable: false);
  }

  Map<String, dynamic> get _summary {
    final value = _earningData['summary'];

    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return value.map((key, value) => MapEntry(key.toString(), value));
    }

    return const <String, dynamic>{};
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final earnings = await _api.getEarnings();
      final payouts = await _api.getPayouts();

      if (!mounted) return;

      setState(() {
        _earningData = earnings;
        _payouts = payouts;
        _loading = false;
      });
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  String _money(dynamic value, [String currency = 'INR']) {
    final text = _text(value);
    if (text.isEmpty) return ' 0';
    return ' ';
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'AVAILABLE':
      case 'PAID':
      case 'COMPLETED':
        return Colors.greenAccent;
      case 'PENDING':
      case 'PAYOUT_REQUESTED':
      case 'REQUESTED':
      case 'PROCESSING':
        return Colors.orangeAccent;
      case 'REVERSED':
      case 'FAILED':
      case 'CANCELLED':
        return Colors.redAccent;
      default:
        return AppColors.gold;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090909),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090909),
        foregroundColor: AppColors.white,
        title: const Text(
          'Earnings & Payouts',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(onRefresh: _load, child: _buildBody()),
    );
  }

  bool _requestingPayout = false;

  double _financeAmount(dynamic value) {
    if (value is num) {
      return value.toDouble();
    }

    return double.tryParse(_text(value)) ?? 0;
  }

  double get _availableEarningsAmount {
    var total = 0.0;

    for (final earning in _earnings) {
      final status = _text(earning['status']).trim().toUpperCase();

      if (status != 'AVAILABLE') {
        continue;
      }

      total += _financeAmount(earning['netAmount'] ?? earning['sellerAmount']);
    }

    return total;
  }

  String get _availableEarningsCurrency {
    for (final earning in _earnings) {
      final status = _text(earning['status']).trim().toUpperCase();

      if (status != 'AVAILABLE') {
        continue;
      }

      final currency = _text(earning['currency']).trim().toUpperCase();

      if (currency.isNotEmpty) {
        return currency;
      }
    }

    return 'INR';
  }

  Future<void> _requestMarketplacePayout() async {
    if (_requestingPayout || _availableEarningsAmount <= 0) {
      return;
    }

    final amount = _availableEarningsAmount;
    final currency = _availableEarningsCurrency;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Withdraw earnings?'),
          content: Text(
            'Request withdrawal of ${_money(amount, currency)} available marketplace earnings?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Request withdrawal'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _requestingPayout = true;
    });

    try {
      await MarketplaceSellerApi().requestPayout();

      if (!mounted) {
        return;
      }

      await _load();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Marketplace withdrawal request submitted successfully.',
          ),
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() {
          _requestingPayout = false;
        });
      }
    }
  }

  Widget _withdrawCard() {
    final available = _availableEarningsAmount;
    final currency = _availableEarningsCurrency;
    final canWithdraw = available > 0 && !_requestingPayout;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(
                Icons.account_balance_wallet_outlined,
                color: AppColors.gold,
              ),
              SizedBox(width: 10),
              Text(
                'Available to withdraw',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            _money(available, currency),
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            available > 0
                ? 'Only delivered and available marketplace earnings can be requested.'
                : 'No marketplace earnings are currently available for withdrawal.',
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.62),
              fontSize: 12,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: canWithdraw ? _requestMarketplacePayout : null,
              icon: _requestingPayout
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.payments_outlined),
              label: Text(
                _requestingPayout ? 'Requesting...' : 'Withdraw Earnings',
              ),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 220),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 120),
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.gold,
            size: 48,
          ),
          const SizedBox(height: 14),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white),
          ),
          const SizedBox(height: 18),
          Center(
            child: FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
      children: [
        _summaryCard(),
        const SizedBox(height: 22),
        _withdrawCard(),
        const SizedBox(height: 22),
        _sectionTitle(
          icon: Icons.account_balance_wallet_outlined,
          title: 'Earning History',
        ),
        const SizedBox(height: 10),
        if (_earnings.isEmpty)
          _emptyCard(
            icon: Icons.savings_outlined,
            title: 'No marketplace earnings yet',
            message:
                'Earnings will appear here only after a customer payment is verified and marketplace accounting is created.',
          )
        else
          ..._earnings.map(_earningCard),
        const SizedBox(height: 24),
        _sectionTitle(
          icon: Icons.receipt_long_outlined,
          title: 'Payout History',
        ),
        const SizedBox(height: 10),
        if (_payouts.isEmpty)
          _emptyCard(
            icon: Icons.payments_outlined,
            title: 'No payouts yet',
            message:
                'Marketplace seller payout history will appear here when payout records exist.',
          )
        else
          ..._payouts.map(_payoutCard),
      ],
    );
  }

  Widget _summaryCard() {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.monetization_on_outlined, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Marketplace Finance',
                style: TextStyle(
                  color: AppColors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _summaryTile('Earnings', _earnings.length.toString()),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _summaryTile('Payouts', _payouts.length.toString()),
              ),
            ],
          ),
          if (_summary.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              'Finance summary is calculated by the server.',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.62),
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _summaryTile(String title, String value) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF0E0E0E),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value,
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 21,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            title,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.7),
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionTitle({required IconData icon, required String title}) {
    return Row(
      children: [
        Icon(icon, color: AppColors.gold, size: 21),
        const SizedBox(width: 9),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 17,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _emptyCard({
    required IconData icon,
    required String title,
    required String message,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 32),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.gold, size: 46),
          const SizedBox(height: 14),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white.withValues(alpha: 0.58),
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _earningCard(Map<String, dynamic> earning) {
    final status = _text(earning['status']);
    final currency = _text(earning['currency']).isEmpty
        ? 'INR'
        : _text(earning['currency']);
    final net = earning['netAmount'] ?? earning['sellerAmount'];
    final gross = earning['grossAmount'] ?? earning['amount'];

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  _money(net, currency),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                status.isEmpty ? 'PENDING' : status,
                style: TextStyle(
                  color: _statusColor(status),
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
          if (gross != null) ...[
            const SizedBox(height: 6),
            Text(
              'Gross: ',
              style: TextStyle(
                color: AppColors.white.withValues(alpha: 0.62),
                fontSize: 12,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _payoutCard(Map<String, dynamic> payout) {
    final status = _text(payout['status']);
    final currency = _text(payout['currency']).isEmpty
        ? 'INR'
        : _text(payout['currency']);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          const Icon(Icons.payments_outlined, color: AppColors.gold),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _money(payout['amount'], currency),
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  status.isEmpty ? 'REQUESTED' : status,
                  style: TextStyle(
                    color: _statusColor(status),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
