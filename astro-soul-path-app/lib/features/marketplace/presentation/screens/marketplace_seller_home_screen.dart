import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/marketplace_seller_api.dart';
import 'marketplace_product_form_screen.dart';
import 'marketplace_seller_finance_screen.dart';
import 'marketplace_seller_orders_screen.dart';
import 'marketplace_seller_profile_screen.dart';

class MarketplaceSellerHomeScreen extends StatefulWidget {
  const MarketplaceSellerHomeScreen({super.key});

  @override
  State<MarketplaceSellerHomeScreen> createState() =>
      _MarketplaceSellerHomeScreenState();
}

class _MarketplaceSellerHomeScreenState
    extends State<MarketplaceSellerHomeScreen> {
  final MarketplaceSellerApi _api = MarketplaceSellerApi();

  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _products = const <Map<String, dynamic>>[];

  String _text(dynamic value) {
    return value?.toString().trim() ?? '';
  }

  String get _sellerStatus {
    return _text(_profile?['status']).toUpperCase();
  }

  bool get _sellerActive {
    return _sellerStatus == 'ACTIVE';
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
      final profile = await _api.getProfile();

      List<Map<String, dynamic>> products = const <Map<String, dynamic>>[];

      if (_text(profile?['status']).toUpperCase() == 'ACTIVE') {
        products = await _api.getProducts();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _profile = profile;
        _products = products;
        _loading = false;
      });
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _openProfile() async {
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) =>
            MarketplaceSellerProfileScreen(initialProfile: _profile),
      ),
    );

    if (result != null && mounted) {
      await _load();
    }
  }

  Future<void> _openOrders() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const MarketplaceSellerOrdersScreen()),
    );
  }

  Future<void> _openFinance() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const MarketplaceSellerFinanceScreen()),
    );
  }

  Future<void> _openProduct([Map<String, dynamic>? product]) async {
    final changed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => MarketplaceProductFormScreen(product: product),
      ),
    );

    if (changed == true && mounted) {
      await _load();
    }
  }

  Future<bool> _confirm({
    required String title,
    required String message,
    required String action,
  }) async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop(false);
                },
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop(true);
                },
                child: Text(action),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<void> _submitProduct(Map<String, dynamic> product) async {
    final productId = _text(product['id']);

    if (productId.isEmpty) {
      return;
    }

    final confirmed = await _confirm(
      title: 'Submit for review?',
      message:
          'The product will move to admin review and cannot be edited while review is pending.',
      action: 'Submit',
    );

    if (!confirmed) {
      return;
    }

    try {
      await _api.submitProduct(productId: productId);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Product submitted for admin review.')),
      );

      await _load();
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _archiveProduct(Map<String, dynamic> product) async {
    final productId = _text(product['id']);

    if (productId.isEmpty) {
      return;
    }

    final confirmed = await _confirm(
      title: 'Archive product?',
      message: 'Only draft or rejected products can be archived by the seller.',
      action: 'Archive',
    );

    if (!confirmed) {
      return;
    }

    try {
      await _api.archiveProduct(productId: productId);

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Product archived.')));

      await _load();
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
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
          'Soul Bazaar Seller',
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
      floatingActionButton: _sellerActive
          ? FloatingActionButton.extended(
              onPressed: () => _openProduct(),
              icon: const Icon(Icons.add_rounded),
              label: const Text('Add Product'),
            )
          : null,
      body: RefreshIndicator(onRefresh: _load, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        physics: AlwaysScrollableScrollPhysics(),
        children: [
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
          const SizedBox(height: 100),
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.gold,
            size: 48,
          ),
          const SizedBox(height: 16),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white, height: 1.4),
          ),
          const SizedBox(height: 20),
          Center(
            child: FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Try again'),
            ),
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 90),
      children: [
        _profileCard(),
        const SizedBox(height: 20),
        if (!_sellerActive) _sellerAccessState(),
        if (_sellerActive) ...[
          Container(
            width: double.infinity,
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
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: AppColors.gold.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(
                          color: AppColors.gold.withValues(alpha: 0.18),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.local_shipping_outlined,
                        color: AppColors.gold,
                        size: 23,
                      ),
                    ),
                    const SizedBox(width: 13),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Seller Orders',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.1,
                            ),
                          ),
                          SizedBox(height: 4),
                          Text(
                            'Manage orders, fulfillment and store earnings.',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Color(0xFF9D9D9D),
                              fontSize: 11.5,
                              height: 1.35,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: FilledButton.icon(
                          onPressed: _openOrders,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.gold,
                            foregroundColor: Colors.black,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          icon: const Icon(
                            Icons.receipt_long_rounded,
                            size: 18,
                          ),
                          label: const Text(
                            'Orders',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(width: 10),

                    Expanded(
                      child: SizedBox(
                        height: 44,
                        child: OutlinedButton.icon(
                          onPressed: _openFinance,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.gold,
                            backgroundColor: AppColors.gold.withValues(
                              alpha: 0.06,
                            ),
                            side: BorderSide(
                              color: AppColors.gold.withValues(alpha: 0.45),
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                          ),
                          icon: const Icon(
                            Icons.account_balance_wallet_rounded,
                            size: 18,
                          ),
                          label: const Text(
                            'Earnings',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            '${_products.length} product${_products.length == 1 ? '' : 's'}',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 12),
          if (_products.isEmpty) _emptyProducts(),
          ..._products.map(_productCard),
        ],
      ],
    );
  }

  Widget _profileCard() {
    final shopName = _text(_profile?['shopDisplayName']);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.storefront_rounded, color: AppColors.gold),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  shopName.isEmpty ? 'Seller Profile' : shopName,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _profile == null
                ? 'Seller profile has not been created.'
                : 'Status: ${_sellerStatus.replaceAll('_', ' ')}',
            style: const TextStyle(
              color: AppColors.gold,
              fontWeight: FontWeight.w700,
            ),
          ),
          if (_text(_profile?['rejectionReason']).isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              _text(_profile?['rejectionReason']),
              style: const TextStyle(color: Colors.redAccent),
            ),
          ],
          const SizedBox(height: 14),
          OutlinedButton.icon(
            onPressed: _sellerStatus == 'SUSPENDED' ? null : _openProfile,
            icon: const Icon(Icons.edit_outlined),
            label: Text(
              _profile == null
                  ? 'Set up seller profile'
                  : 'Edit seller profile',
            ),
          ),
        ],
      ),
    );
  }

  Widget _sellerAccessState() {
    String message;

    switch (_sellerStatus) {
      case 'PENDING':
        message = 'Your seller profile is waiting for admin approval.';
        break;

      case 'REJECTED':
        message =
            'Your seller profile was rejected. Update the profile to request review again.';
        break;

      case 'SUSPENDED':
        message = 'Marketplace seller access is currently suspended.';
        break;

      default:
        message =
            'Set up your seller profile. Product management becomes available only after admin approval.';
    }

    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.white, height: 1.5),
      ),
    );
  }

  Widget _emptyProducts() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
      ),
      child: const Column(
        children: [
          Icon(Icons.inventory_2_outlined, color: AppColors.gold, size: 40),
          SizedBox(height: 12),
          Text(
            'No products yet',
            style: TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 7),
          Text(
            'Create your first product draft using Add Product.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Color(0xFF9A9A9A)),
          ),
        ],
      ),
    );
  }

  Widget _productCard(Map<String, dynamic> product) {
    final status = _text(product['status']).toUpperCase();

    final editable = status == 'DRAFT' || status == 'REJECTED';

    final category = product['category'];

    final categoryName = category is Map ? _text(category['name']) : '';

    final sellingPrice = _text(product['sellingPrice']);
    final stock = _text(product['stock']);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _text(product['name']).isEmpty
                ? 'Unnamed product'
                : _text(product['name']),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            status.isEmpty ? 'STATUS UNAVAILABLE' : status.replaceAll('_', ' '),
            style: const TextStyle(
              color: AppColors.gold,
              fontWeight: FontWeight.w700,
              fontSize: 12,
            ),
          ),
          if (categoryName.isNotEmpty) ...[
            const SizedBox(height: 7),
            Text(
              categoryName,
              style: TextStyle(color: AppColors.white.withValues(alpha: 0.65)),
            ),
          ],
          const SizedBox(height: 8),
          Text(
            [
              if (sellingPrice.isNotEmpty) 'INR $sellingPrice',
              if (stock.isNotEmpty) 'Stock $stock',
            ].join('  |  '),
            style: TextStyle(color: AppColors.white.withValues(alpha: 0.65)),
          ),
          if (_text(product['rejectionReason']).isNotEmpty) ...[
            const SizedBox(height: 9),
            Text(
              'Admin: ${_text(product['rejectionReason'])}',
              style: const TextStyle(color: Colors.redAccent),
            ),
          ],
          if (editable) ...[
            const SizedBox(height: 14),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                OutlinedButton.icon(
                  onPressed: () => _openProduct(product),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Edit'),
                ),
                FilledButton.icon(
                  onPressed: () => _submitProduct(product),
                  icon: const Icon(Icons.send_outlined),
                  label: const Text('Submit Review'),
                ),
                TextButton.icon(
                  onPressed: () => _archiveProduct(product),
                  icon: const Icon(Icons.archive_outlined),
                  label: const Text('Archive'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
