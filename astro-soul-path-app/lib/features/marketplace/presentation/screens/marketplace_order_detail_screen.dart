import 'package:flutter/material.dart';

import '../../data/marketplace_customer_api.dart';

class MarketplaceOrderDetailScreen extends StatefulWidget {
  const MarketplaceOrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<MarketplaceOrderDetailScreen> createState() =>
      _MarketplaceOrderDetailScreenState();
}

class _MarketplaceOrderDetailScreenState
    extends State<MarketplaceOrderDetailScreen> {
  static const Color _background = Color(0xFF090909);
  static const Color _surface = Color(0xFF151515);
  static const Color _gold = Color(0xFFF2C94C);
  static const Color _muted = Color(0xFF9A9A9A);

  final MarketplaceCustomerApi _api = MarketplaceCustomerApi();

  Map<String, dynamic>? _order;
  bool _loading = true;
  String _error = '';

  String _text(dynamic value) => value?.toString().trim() ?? '';

  String _money(dynamic value) {
    final parsed = num.tryParse(_text(value));
    if (parsed == null) return '0';
    return parsed % 1 == 0
        ? parsed.toStringAsFixed(0)
        : parsed.toStringAsFixed(2);
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final order = await _api.getOrder(orderId: widget.orderId);

      if (!mounted) return;

      setState(() {
        _order = order;
        _loading = false;
      });
    } on MarketplaceCustomerApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _error = 'Unable to load order details.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _background,
      appBar: AppBar(
        backgroundColor: _background,
        foregroundColor: Colors.white,
        title: const Text(
          'Order Details',
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
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: _gold));
    }

    if (_error.isNotEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: _gold, size: 44),
              const SizedBox(height: 14),
              Text(
                _error,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white),
              ),
              const SizedBox(height: 18),
              FilledButton.icon(
                onPressed: _load,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final order = _order;

    if (order == null) {
      return const Center(
        child: Text('Order not found', style: TextStyle(color: Colors.white)),
      );
    }

    final status = _text(order['status']).toUpperCase();
    final orderNumber = _text(order['orderNumber']);
    final currency = _text(order['currency']).isEmpty
        ? 'INR'
        : _text(order['currency']);

    final sellerOrdersRaw = order['sellerOrders'];
    final sellerOrders = sellerOrdersRaw is List
        ? sellerOrdersRaw.whereType<Map>().toList()
        : <Map>[];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
        children: [
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Order',
                  style: TextStyle(color: _gold, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  orderNumber,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 12),
                _statusChip(status),
                const SizedBox(height: 14),
                _row('Subtotal', '$currency ${_money(order['subtotal'])}'),
                _row('Shipping', '$currency ${_money(order['shippingTotal'])}'),
                const Divider(color: Color(0xFF303030)),
                _row(
                  'Total',
                  '$currency ${_money(order['grandTotal'])}',
                  strong: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Delivery Address',
                  style: TextStyle(color: _gold, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 10),
                Text(
                  _text(order['fullName']),
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  _address(order),
                  style: const TextStyle(color: _muted, height: 1.45),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          ...sellerOrders.map((sellerOrder) {
            final map = Map<String, dynamic>.from(sellerOrder);
            return Padding(
              padding: const EdgeInsets.only(bottom: 14),
              child: _sellerCard(map, currency),
            );
          }),
        ],
      ),
    );
  }

  Widget _sellerCard(Map<String, dynamic> sellerOrder, String currency) {
    final itemsRaw = sellerOrder['items'];
    final items = itemsRaw is List
        ? itemsRaw.whereType<Map>().toList()
        : <Map>[];

    final status = _text(sellerOrder['status']).toUpperCase();
    final sellerName = _text(sellerOrder['sellerDisplayName']);

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            sellerName.isEmpty ? 'Seller' : sellerName,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 8),
          _statusChip(status),
          const SizedBox(height: 14),
          ...items.map((itemValue) {
            final item = Map<String, dynamic>.from(itemValue);

            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1C1C1C),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.inventory_2_outlined, color: _gold),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _text(item['productName']),
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Qty ${_text(item['quantity'])} | '
                          '$currency ${_money(item['lineTotal'])}',
                          style: const TextStyle(color: _muted),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          if (_text(sellerOrder['trackingCarrier']).isNotEmpty ||
              _text(sellerOrder['trackingNumber']).isNotEmpty) ...[
            const Divider(color: Color(0xFF303030)),
            _row('Carrier', _text(sellerOrder['trackingCarrier'])),
            _row('Tracking', _text(sellerOrder['trackingNumber'])),
          ],
        ],
      ),
    );
  }

  Widget _card({required Widget child}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: _gold.withValues(alpha: 0.16)),
      ),
      child: child,
    );
  }

  Widget _row(String label, String value, {bool strong = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: _muted)),
          ),
          Text(
            value,
            style: TextStyle(
              color: Colors.white,
              fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: _gold.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(30),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: const TextStyle(
          color: _gold,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  String _address(Map<String, dynamic> order) {
    final values = <String>[
      _text(order['addressLine1']),
      _text(order['addressLine2']),
      _text(order['landmark']),
      _text(order['city']),
      _text(order['state']),
      _text(order['postalCode']),
      _text(order['country']),
    ].where((value) => value.isNotEmpty).toList();

    return values.join(', ');
  }
}
