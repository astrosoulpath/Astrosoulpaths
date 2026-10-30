import '../marketplace_palette.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../data/marketplace_customer_api.dart';
import '../../data/marketplace_public_api.dart';
import '../../../profile/data/profile_api.dart';
import 'marketplace_cart_screen.dart';

class MarketplaceProductDetailScreen extends StatefulWidget {
  const MarketplaceProductDetailScreen({super.key, required this.productId});

  final String productId;

  @override
  State<MarketplaceProductDetailScreen> createState() =>
      _MarketplaceProductDetailScreenState();
}

class _MarketplaceProductDetailScreenState
    extends State<MarketplaceProductDetailScreen> {
  static const _gold = MarketplacePalette.gold;

  final MarketplacePublicApi _publicApi = MarketplacePublicApi();
  final MarketplaceCustomerApi _customerApi = MarketplaceCustomerApi();
  final ProfileApi _profileApi = ProfileApi();

  String? _countryCode;
  Map<String, dynamic>? _product;
  bool _loading = true;
  bool _adding = false;
  String _error = '';
  int _quantity = 1;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _publicApi.dispose();
    _customerApi.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      try {
        final profiles = await _profileApi.getProfiles();
        if (profiles.isNotEmpty) {
          final code = profiles.first.countryCode?.trim().toUpperCase() ?? '';
          _countryCode = code.isEmpty ? null : code;
        }
      } catch (_) {
        // Product remains available; backend safely falls back to INR.
      }

      final product = await _publicApi.getProduct(
        widget.productId,
        countryCode: _countryCode,
      );

      if (!mounted) return;

      setState(() {
        _product = product;
        _loading = false;
      });
    } on MarketplacePublicApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _addToCart() async {
    if (_adding || _product == null) return;

    final productId = _text(_product!['id']);

    if (productId.isEmpty) return;

    setState(() => _adding = true);

    try {
      await _customerApi.addCartItem(productId: productId, quantity: _quantity);

      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Product added to cart.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
    } on MarketplaceCustomerApiException catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            behavior: SnackBarBehavior.floating,
          ),
        );
    } finally {
      if (mounted) {
        setState(() => _adding = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        title: const Text('Product Details'),
        actions: [
          IconButton(
            tooltip: 'Share product',
            icon: const Icon(Icons.share_outlined),
            onPressed: _product == null
                ? null
                : () {
                    final box = context.findRenderObject() as RenderBox?;
                    SharePlus.instance.share(
                      ShareParams(
                        text:
                            '${_text(_product?['name'])}\nFind this product in Astro Soul Path Soul Bazaar. Product ID: ${widget.productId}',
                        sharePositionOrigin: box == null
                            ? null
                            : box.localToGlobal(Offset.zero) & box.size,
                      ),
                    );
                  },
          ),
          IconButton(
            tooltip: 'Cart',
            icon: const Icon(Icons.shopping_bag_outlined, color: _gold),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const MarketplaceCartScreen(),
                ),
              );
            },
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
              const Icon(Icons.cloud_off_outlined, color: _gold, size: 42),
              const SizedBox(height: 16),
              Text(
                _error,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurface,
                ),
              ),
              const SizedBox(height: 18),
              OutlinedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final product = _product;

    if (product == null) {
      return Center(
        child: Text(
          'Product unavailable.',
          style: TextStyle(color: Theme.of(context).colorScheme.onSurface),
        ),
      );
    }

    final name = _text(product['name']);
    final description = _text(product['description']).isNotEmpty
        ? _text(product['description'])
        : _text(product['shortDescription']);

    final displayCurrency = _text(product['displayCurrency']);
    final baseCurrency = _text(product['currency']);

    final currency = displayCurrency.isNotEmpty
        ? displayCurrency
        : (baseCurrency.isEmpty ? 'INR' : baseCurrency);

    final sellingPrice = _money(
      product['displaySellingPrice'] ?? product['sellingPrice'],
    );
    final mrp = _money(product['displayMrp'] ?? product['mrp']);
    final shipping = _money(
      product['displayShippingCharge'] ?? product['shippingCharge'],
    );
    final stock = _int(product['stock']);

    final category = product['category'];
    final categoryName = category is Map ? _text(category['name']) : '';

    final seller = product['astrologer'];
    String sellerName = '';

    if (seller is Map) {
      sellerName = _text(seller['shopDisplayName']);

      if (sellerName.isEmpty && seller['user'] is Map) {
        sellerName = _text((seller['user'] as Map)['name']);
      }
    }

    final images = product['images'];
    final imageUrls = <String>[];

    if (images is List) {
      for (final item in images) {
        if (item is Map) {
          final url = _text(item['url']).isNotEmpty
              ? _text(item['url'])
              : _text(item['imageUrl']);

          if (url.isNotEmpty) {
            imageUrls.add(url);
          }
        }
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
      children: [
        Container(
          height: 300,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(24),
          ),
          child: imageUrls.isEmpty
              ? const Center(
                  child: Icon(
                    Icons.inventory_2_outlined,
                    color: _gold,
                    size: 70,
                  ),
                )
              : PageView.builder(
                  itemCount: imageUrls.length,
                  itemBuilder: (_, index) {
                    return Image.network(
                      imageUrls[index],
                      fit: BoxFit.cover,
                      errorBuilder: (_, _, _) {
                        return const Center(
                          child: Icon(
                            Icons.inventory_2_outlined,
                            color: _gold,
                            size: 60,
                          ),
                        );
                      },
                    );
                  },
                ),
        ),
        const SizedBox(height: 20),
        if (categoryName.isNotEmpty)
          Text(
            categoryName,
            style: const TextStyle(color: _gold, fontWeight: FontWeight.w700),
          ),
        const SizedBox(height: 6),
        Text(
          name.isEmpty ? 'Marketplace product' : name,
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 24,
            fontWeight: FontWeight.w900,
          ),
        ),
        if (sellerName.isNotEmpty) ...[
          const SizedBox(height: 7),
          Text(
            'Sold by $sellerName',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
        const SizedBox(height: 16),
        Row(
          children: [
            Text(
              '${_symbol(currency)}$sellingPrice',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 23,
                fontWeight: FontWeight.w900,
              ),
            ),
            if (mrp != '0' && mrp != sellingPrice) ...[
              const SizedBox(width: 10),
              Text(
                '${_symbol(currency)}$mrp',
                style: TextStyle(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                  decoration: TextDecoration.lineThrough,
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                stock > 0 ? '$stock in stock' : 'Out of stock',
                style: TextStyle(
                  color: stock > 0 ? _gold : Colors.redAccent,
                  fontWeight: FontWeight.w700,
                ),
              ),
              if (shipping != '0') ...[
                const SizedBox(height: 8),
                Text(
                  'Shipping: ${_symbol(currency)}$shipping',
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (description.isNotEmpty) ...[
          const SizedBox(height: 22),
          Text(
            'Description',
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurface,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: TextStyle(
              color: Theme.of(context).colorScheme.onSurfaceVariant,
              height: 1.5,
            ),
          ),
        ],
        const SizedBox(height: 26),
        Row(
          children: [
            Container(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _quantity > 1
                        ? () => setState(() => _quantity--)
                        : null,
                    icon: const Icon(Icons.remove),
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                  Text(
                    '$_quantity',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  IconButton(
                    onPressed: _quantity < stock
                        ? () => setState(() => _quantity++)
                        : null,
                    icon: const Icon(Icons.add),
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: _gold,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: stock > 0 && !_adding ? _addToCart : null,
                icon: _adding
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.black,
                        ),
                      )
                    : const Icon(Icons.add_shopping_cart_rounded),
                label: Text(_adding ? 'Adding...' : 'Add to Cart'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  int _int(dynamic value) => int.tryParse(value?.toString() ?? '') ?? 0;

  String _text(dynamic value) => value?.toString().trim() ?? '';

  String _money(dynamic value) {
    final number = double.tryParse(value?.toString() ?? '') ?? 0;

    if (number == number.roundToDouble()) {
      return number.toStringAsFixed(0);
    }

    return number.toStringAsFixed(2);
  }

  String _symbol(String currency) {
    switch (currency.toUpperCase()) {
      case 'INR':
        return '₹';
      case 'USD':
        return r'$';
      case 'EUR':
        return '€';
      case 'GBP':
        return '£';
      default:
        return '$currency ';
    }
  }
}
