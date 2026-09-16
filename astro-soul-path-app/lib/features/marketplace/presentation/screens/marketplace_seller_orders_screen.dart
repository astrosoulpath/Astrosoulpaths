import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/marketplace_seller_api.dart';

class MarketplaceSellerOrdersScreen extends StatefulWidget {
  const MarketplaceSellerOrdersScreen({super.key});

  @override
  State<MarketplaceSellerOrdersScreen> createState() =>
      _MarketplaceSellerOrdersScreenState();
}

class _MarketplaceSellerOrdersScreenState
    extends State<MarketplaceSellerOrdersScreen> {
  final MarketplaceSellerApi _api = MarketplaceSellerApi();

  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _orders = const <Map<String, dynamic>>[];

  String _text(dynamic value) => value?.toString().trim() ?? '';

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
      final orders = await _api.getOrders();

      if (!mounted) return;

      setState(() {
        _orders = orders;
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090909),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090909),
        foregroundColor: AppColors.white,
        title: const Text(
          'Marketplace Orders',
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
            size: 46,
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

    if (_orders.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: const [
          SizedBox(height: 120),
          Icon(Icons.local_shipping_outlined, color: AppColors.gold, size: 52),
          SizedBox(height: 16),
          Text(
            'No fulfillment orders yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white,
              fontSize: 19,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Only confirmed customer orders appear here after verified payment.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF9A9A9A), height: 1.4),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
      itemCount: _orders.length,
      separatorBuilder: (_, _) => const SizedBox(height: 12),
      itemBuilder: (_, index) => _orderCard(_orders[index]),
    );
  }

  Widget _orderCard(Map<String, dynamic> sellerOrder) {
    final parent = sellerOrder['order'];
    final order = parent is Map ? parent : const <String, dynamic>{};

    final orderNumber = _text(order['orderNumber']);
    final status = _text(sellerOrder['status']).toUpperCase();
    final currency = _text(sellerOrder['currency']);
    final total = _text(sellerOrder['grandTotal']);

    final rawItems = sellerOrder['items'];
    final itemCount = rawItems is List ? rawItems.length : 0;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.22)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  orderNumber.isEmpty ? 'Marketplace Order' : orderNumber,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  status,
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '$itemCount item${itemCount == 1 ? '' : 's'}  |  $currency $total',
            style: const TextStyle(color: Color(0xFFBDBDBD)),
          ),
          const SizedBox(height: 12),
          const Text(
            'Fulfillment actions will follow the server-controlled order status.',
            style: TextStyle(
              color: Color(0xFF8D8D8D),
              fontSize: 12,
              height: 1.35,
            ),
          ),
        ],
      ),
    );
  }
}
