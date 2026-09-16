import 'package:flutter/material.dart';

import '../../data/marketplace_public_api.dart';
import 'marketplace_cart_screen.dart';
import 'marketplace_orders_screen.dart';
import 'marketplace_product_detail_screen.dart';

class MarketplaceHomeScreen extends StatefulWidget {
  const MarketplaceHomeScreen({super.key});

  @override
  State<MarketplaceHomeScreen> createState() => _MarketplaceHomeScreenState();
}

class _MarketplaceHomeScreenState extends State<MarketplaceHomeScreen> {
  static const Color _background = Color(0xFF090909);
  static const Color _surface = Color(0xFF151515);
  static const Color _surfaceSoft = Color(0xFF1C1C1C);
  static const Color _gold = Color(0xFFF2C94C);
  static const Color _muted = Color(0xFF9A9A9A);

  final MarketplacePublicApi _api = MarketplacePublicApi();
  final TextEditingController _searchController = TextEditingController();

  List<Map<String, dynamic>> _categories = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _products = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _campaigns = <Map<String, dynamic>>[];

  bool _loading = true;
  bool _productsLoading = false;
  bool _featuredOnly = false;

  String? _selectedCategoryId;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _loadMarketplace();
  }

  @override
  void dispose() {
    _api.dispose();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadMarketplace() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final categories = await _api.getCategories();
      final campaigns = await _api.getCampaigns();
      final products = await _api.getProducts(
        search: _searchController.text,
        categoryId: _selectedCategoryId,
        featuredOnly: _featuredOnly,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _categories = categories;
        _campaigns = campaigns;
        _products = products;
        _loading = false;
        _error = '';
      });
    } on MarketplacePublicApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.message;
      });
    }
  }

  Future<void> _loadProducts() async {
    if (mounted) {
      setState(() {
        _productsLoading = true;
        _error = '';
      });
    }

    try {
      final products = await _api.getProducts(
        search: _searchController.text,
        categoryId: _selectedCategoryId,
        featuredOnly: _featuredOnly,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _products = products;
        _productsLoading = false;
        _error = '';
      });
    } on MarketplacePublicApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _productsLoading = false;
        _error = error.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _background,
      body: SafeArea(
        child: RefreshIndicator(
          color: _gold,
          backgroundColor: _surface,
          onRefresh: _loadMarketplace,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              SliverToBoxAdapter(child: _buildHeader(context)),
              SliverToBoxAdapter(child: _buildSearchBar()),
              SliverToBoxAdapter(child: _buildFestivalBanner()),
              SliverToBoxAdapter(
                child: _buildSectionHeader(
                  title: 'Categories',
                  subtitle: 'Explore by category',
                ),
              ),
              SliverToBoxAdapter(child: _buildCategories()),
              SliverToBoxAdapter(child: _buildProductHeader()),
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 6, 16, 24),
                sliver: SliverToBoxAdapter(child: _buildProductsState()),
              ),
              SliverToBoxAdapter(child: _buildTrustSection()),
              const SliverToBoxAdapter(child: SizedBox(height: 32)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: _surfaceSoft,
              borderRadius: BorderRadius.circular(15),
              border: Border.all(color: _gold.withValues(alpha: 0.25)),
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: _gold,
              size: 23,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Soul Bazaar',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.4,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Spiritual products from verified sellers',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: _muted,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          _headerAction(
            icon: Icons.refresh_rounded,
            tooltip: 'Refresh marketplace',
            onTap: _loadMarketplace,
          ),
          const SizedBox(width: 8),
          _headerAction(
            icon: Icons.receipt_long_outlined,
            tooltip: 'Orders',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const MarketplaceOrdersScreen(),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
          _headerAction(
            icon: Icons.shopping_bag_outlined,
            tooltip: 'Cart',
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const MarketplaceCartScreen(),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _headerAction({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: _surface,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          borderRadius: BorderRadius.circular(14),
          onTap: onTap,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
            ),
            child: Icon(icon, color: Colors.white, size: 21),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
      child: Container(
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(17),
          border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
        ),
        child: TextField(
          controller: _searchController,
          cursorColor: _gold,
          style: const TextStyle(color: Colors.white, fontSize: 15),
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search products...',
            hintStyle: const TextStyle(color: _muted, fontSize: 14),
            prefixIcon: const Icon(Icons.search_rounded, color: _muted),
            suffixIcon: _searchController.text.trim().isEmpty
                ? const Icon(Icons.tune_rounded, color: _gold)
                : IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      _searchController.clear();
                      setState(() {});
                      _loadProducts();
                    },
                    icon: const Icon(Icons.close_rounded, color: _gold),
                  ),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 16),
          ),
          onChanged: (_) {
            setState(() {});
          },
          onSubmitted: (_) {
            _loadProducts();
          },
        ),
      ),
    );
  }

  Widget _buildFestivalBanner() {
    if (_loading) {
      return Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: Container(
          height: 160,
          decoration: BoxDecoration(
            color: _surface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: _gold.withValues(alpha: 0.15)),
          ),
          child: const Center(
            child: CircularProgressIndicator(color: _gold, strokeWidth: 2),
          ),
        ),
      );
    }

    if (_campaigns.isEmpty) {
      return _campaignShell(
        badge: 'ADMIN CONTROLLED',
        title: 'Festival offers',
        description: 'Live campaigns will appear here when enabled by admin.',
      );
    }

    final campaign = _campaigns.first;

    final title = _firstText(<dynamic>[
      campaign['name'],
      campaign['title'],
    ], fallback: 'Festival offer');

    final description = _firstText(<dynamic>[
      campaign['description'],
      campaign['subtitle'],
    ], fallback: 'A live marketplace campaign is active.');

    return _campaignShell(
      badge: 'LIVE CAMPAIGN',
      title: title,
      description: description,
    );
  }

  Widget _campaignShell({
    required String badge,
    required String title,
    required String description,
  }) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          gradient: const LinearGradient(
            colors: [Color(0xFF2A2312), Color(0xFF17140D)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          border: Border.all(color: _gold.withValues(alpha: 0.25)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: _gold.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: _gold,
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    description,
                    style: const TextStyle(
                      color: Color(0xFFC3BDAE),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 66,
              height: 66,
              decoration: BoxDecoration(
                color: _gold.withValues(alpha: 0.10),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.celebration_outlined,
                color: _gold,
                size: 31,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader({required String title, String? subtitle}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    style: const TextStyle(color: _muted, fontSize: 12),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategories() {
    if (_loading) {
      return const SizedBox(
        height: 96,
        child: Center(
          child: CircularProgressIndicator(color: _gold, strokeWidth: 2),
        ),
      );
    }

    final items = <Widget>[
      _categoryItem(id: null, label: 'All', iconUrl: ''),
      ..._categories.map(
        (category) => _categoryItem(
          id: _text(category['id']),
          label: _firstText(<dynamic>[category['name']], fallback: 'Category'),
          iconUrl: _text(category['imageUrl']),
        ),
      ),
    ];

    return SizedBox(
      height: 100,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        children: items,
      ),
    );
  }

  Widget _categoryItem({
    required String? id,
    required String label,
    required String iconUrl,
  }) {
    final active = _selectedCategoryId == id;

    return Padding(
      padding: const EdgeInsets.only(right: 11),
      child: InkWell(
        borderRadius: BorderRadius.circular(19),
        onTap: () {
          if (_selectedCategoryId == id) {
            return;
          }

          setState(() {
            _selectedCategoryId = id;
          });

          _loadProducts();
        },
        child: SizedBox(
          width: 78,
          child: Column(
            children: [
              Container(
                width: 58,
                height: 58,
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: active ? _gold : _surfaceSoft,
                  borderRadius: BorderRadius.circular(19),
                  border: Border.all(
                    color: active
                        ? _gold
                        : Colors.white.withValues(alpha: 0.07),
                  ),
                ),
                child: iconUrl.isNotEmpty
                    ? Image.network(
                        iconUrl,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) {
                          return Icon(
                            Icons.category_outlined,
                            color: active ? Colors.black : _gold,
                          );
                        },
                      )
                    : Icon(
                        id == null
                            ? Icons.grid_view_rounded
                            : Icons.category_outlined,
                        color: active ? Colors.black : _gold,
                        size: 24,
                      ),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: active ? Colors.white : _muted,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildProductHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
      child: Row(
        children: [
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Recommended for you',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Only approved and available products',
                  style: TextStyle(color: _muted, fontSize: 12),
                ),
              ],
            ),
          ),
          FilterChip(
            selected: _featuredOnly,
            showCheckmark: false,
            onSelected: (value) {
              setState(() {
                _featuredOnly = value;
              });

              _loadProducts();
            },
            avatar: Icon(
              _featuredOnly ? Icons.star_rounded : Icons.star_border_rounded,
              size: 17,
              color: _featuredOnly ? Colors.black : _gold,
            ),
            label: const Text('Featured'),
            selectedColor: _gold,
            backgroundColor: _surfaceSoft,
            side: BorderSide(
              color: _featuredOnly
                  ? _gold
                  : Colors.white.withValues(alpha: 0.08),
            ),
            labelStyle: TextStyle(
              color: _featuredOnly ? Colors.black : Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProductsState() {
    if (_loading || _productsLoading) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 46),
        decoration: _panelDecoration(),
        child: const Center(
          child: CircularProgressIndicator(color: _gold, strokeWidth: 2),
        ),
      );
    }

    if (_error.isNotEmpty) {
      return _statePanel(
        icon: Icons.cloud_off_outlined,
        title: 'Marketplace unavailable',
        description: _error,
        actionLabel: 'Retry',
        onAction: _loadMarketplace,
      );
    }

    if (_products.isEmpty) {
      final hasFilters =
          _featuredOnly ||
          _selectedCategoryId != null ||
          _searchController.text.trim().isNotEmpty;

      return _statePanel(
        icon: Icons.inventory_2_outlined,
        title: hasFilters
            ? 'No matching products'
            : 'No approved products available',
        description: hasFilters
            ? 'Try changing the search, category or featured filter.'
            : 'Products will appear automatically after an eligible seller and product are approved by admin.',
        actionLabel: hasFilters ? 'Clear filters' : null,
        onAction: hasFilters
            ? () {
                _searchController.clear();

                setState(() {
                  _selectedCategoryId = null;
                  _featuredOnly = false;
                });

                _loadProducts();
              }
            : null,
      );
    }

    return Column(
      children: _products.map(_buildProductCard).toList(growable: false),
    );
  }

  Widget _buildProductCard(Map<String, dynamic> product) {
    final name = _firstText(<dynamic>[
      product['name'],
    ], fallback: 'Marketplace product');

    final description = _firstText(<dynamic>[
      product['shortDescription'],
      product['description'],
    ], fallback: '');

    final currency = _firstText(<dynamic>[
      product['currency'],
    ], fallback: 'INR');

    final sellingPrice = _money(product['sellingPrice']);
    final mrp = _money(product['mrp']);

    final featured = product['isFeatured'] == true;

    final category = product['category'];

    final categoryName = category is Map
        ? _firstText(<dynamic>[category['name']], fallback: '')
        : '';

    final imageUrl = _productImageUrl(product);

    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Material(
        color: _surface,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          borderRadius: BorderRadius.circular(22),
          onTap: () {
            final id = _text(product['id']);

            if (id.isNotEmpty) {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => MarketplaceProductDetailScreen(productId: id),
                ),
              );
            }
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              border: Border.all(
                color: featured
                    ? _gold.withValues(alpha: 0.30)
                    : Colors.white.withValues(alpha: 0.07),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 92,
                  height: 92,
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: _surfaceSoft,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: imageUrl.isNotEmpty
                      ? Image.network(
                          imageUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) {
                            return const Icon(
                              Icons.inventory_2_outlined,
                              color: _gold,
                              size: 32,
                            );
                          },
                        )
                      : const Icon(
                          Icons.inventory_2_outlined,
                          color: _gold,
                          size: 32,
                        ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (featured)
                        Container(
                          margin: const EdgeInsets.only(bottom: 7),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: _gold.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'FEATURED',
                            style: TextStyle(
                              color: _gold,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                      Text(
                        name,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (categoryName.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          categoryName,
                          style: const TextStyle(
                            color: _gold,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                      if (description.isNotEmpty) ...[
                        const SizedBox(height: 6),
                        Text(
                          description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: _muted,
                            fontSize: 12,
                            height: 1.35,
                          ),
                        ),
                      ],
                      const SizedBox(height: 9),
                      Row(
                        children: [
                          Text(
                            '${_currencySymbol(currency)}$sellingPrice',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          if (mrp != sellingPrice && mrp != '0') ...[
                            const SizedBox(width: 8),
                            Text(
                              '${_currencySymbol(currency)}$mrp',
                              style: const TextStyle(
                                color: _muted,
                                fontSize: 12,
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statePanel({
    required IconData icon,
    required String title,
    required String description,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 38),
      decoration: _panelDecoration(),
      child: Column(
        children: [
          Container(
            width: 70,
            height: 70,
            decoration: BoxDecoration(
              color: _gold.withValues(alpha: 0.09),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: _gold, size: 31),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 17,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            textAlign: TextAlign.center,
            style: const TextStyle(color: _muted, fontSize: 13, height: 1.5),
          ),
          if (actionLabel != null && onAction != null) ...[
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: onAction,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: Text(actionLabel),
              style: OutlinedButton.styleFrom(
                foregroundColor: _gold,
                side: BorderSide(color: _gold.withValues(alpha: 0.55)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  BoxDecoration _panelDecoration() {
    return BoxDecoration(
      color: _surface,
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
    );
  }

  Widget _buildTrustSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: _surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: 0.07)),
        ),
        child: const Row(
          children: [
            Expanded(
              child: _TrustItem(
                icon: Icons.verified_user_outlined,
                title: 'Verified',
                subtitle: 'Sellers',
              ),
            ),
            _Divider(),
            Expanded(
              child: _TrustItem(
                icon: Icons.inventory_2_outlined,
                title: 'Controlled',
                subtitle: 'Inventory',
              ),
            ),
            _Divider(),
            Expanded(
              child: _TrustItem(
                icon: Icons.admin_panel_settings_outlined,
                title: 'Admin',
                subtitle: 'Approved',
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _productImageUrl(Map<String, dynamic> product) {
    final images = product['images'];

    if (images is! List || images.isEmpty) {
      return '';
    }

    final first = images.first;

    if (first is! Map) {
      return '';
    }

    return _firstText(<dynamic>[first['url'], first['imageUrl']], fallback: '');
  }

  String _currencySymbol(String currency) {
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

  String _money(dynamic value) {
    if (value == null) {
      return '0';
    }

    final parsed = double.tryParse(value.toString());

    if (parsed == null) {
      return value.toString();
    }

    if (parsed == parsed.roundToDouble()) {
      return parsed.toStringAsFixed(0);
    }

    return parsed.toStringAsFixed(2);
  }

  String _text(dynamic value) {
    return value?.toString().trim() ?? '';
  }

  String _firstText(List<dynamic> values, {required String fallback}) {
    for (final value in values) {
      final normalized = _text(value);

      if (normalized.isNotEmpty) {
        return normalized;
      }
    }

    return fallback;
  }
}

class _TrustItem extends StatelessWidget {
  const _TrustItem({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    const gold = Color(0xFFF2C94C);

    return Column(
      children: [
        Icon(icon, color: gold, size: 22),
        const SizedBox(height: 7),
        Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 11.5,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          subtitle,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xFF8D8D8D), fontSize: 10),
        ),
      ],
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 1,
      height: 45,
      color: Colors.white.withValues(alpha: 0.08),
    );
  }
}
