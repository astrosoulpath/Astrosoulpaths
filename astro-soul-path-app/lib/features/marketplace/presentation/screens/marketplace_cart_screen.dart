import '../marketplace_private_state.dart';
import '../marketplace_palette.dart';
import '../marketplace_address_picker.dart';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../data/marketplace_customer_api.dart';
import '../../data/marketplace_payment_state.dart';
import 'marketplace_address_screen.dart';

class MarketplaceCartScreen extends StatefulWidget {
  const MarketplaceCartScreen({super.key, this.api});
  final MarketplaceCustomerApi? api;

  @override
  State<MarketplaceCartScreen> createState() => _MarketplaceCartScreenState();
}

class _MarketplaceCartScreenState
    extends MarketplacePrivateState<MarketplaceCartScreen> {
  static const _surface = MarketplacePalette.surface;
  static const _gold = MarketplacePalette.gold;
  static const _muted = MarketplacePalette.muted;

  late final MarketplaceCustomerApi _api =
      widget.api ?? MarketplaceCustomerApi();
  late final Razorpay _razorpay;

  Map<String, dynamic> _cart = {};
  bool _loading = true;
  String _error = '';
  String? _workingItem;
  bool _preparingOrder = false;
  bool _paidCheckoutEnabled = false;
  String? _prepareIdempotencyKey;
  String? _prepareAddressFingerprint;

  String? _paymentMarketplaceOrderId;
  String? _paymentRazorpayOrderId;
  bool _openingPayment = false;
  bool _verifyingPayment = false;
  bool _recoveringPayment = false;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed &&
        _paymentMarketplaceOrderId != null) {
      _recoverPayment();
    }
  }

  Future<void> _recoverPayment() async {
    final id = _paymentMarketplaceOrderId;
    if (id == null || _recoveringPayment || _verifyingPayment) return;
    setState(() => _recoveringPayment = true);
    try {
      final order = await _api.getOrder(orderId: id);
      if (!mounted) return;
      final state = marketplacePaymentState(order);
      if (state == MarketplacePaymentState.pending) {
        _message(
          'Payment status is pending. Check Order History before paying again.',
        );
      } else {
        _paymentMarketplaceOrderId = null;
        _paymentRazorpayOrderId = null;
        _prepareIdempotencyKey = null;
        _message(
          state == MarketplacePaymentState.confirmed
              ? 'Order confirmed by the server.'
              : 'Order cancelled by the server.',
        );
        await _load();
      }
    } catch (_) {
      _message(
        'Unable to check payment status. Do not pay again; check Order History.',
      );
    } finally {
      if (mounted) setState(() => _recoveringPayment = false);
    }
  }

  @override
  void initState() {
    super.initState();

    _razorpay = Razorpay();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);

    _load();
  }

  @override
  void dispose() {
    _razorpay.clear();
    _api.dispose();
    super.dispose();
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    if (_verifyingPayment) return;

    final marketplaceOrderId = _paymentMarketplaceOrderId?.trim() ?? '';
    final expectedRazorpayOrderId = _paymentRazorpayOrderId?.trim() ?? '';

    final razorpayOrderId = response.orderId?.trim() ?? '';
    final razorpayPaymentId = response.paymentId?.trim() ?? '';
    final razorpaySignature = response.signature?.trim() ?? '';

    if (marketplaceOrderId.isEmpty ||
        expectedRazorpayOrderId.isEmpty ||
        razorpayOrderId.isEmpty ||
        razorpayPaymentId.isEmpty ||
        razorpaySignature.isEmpty) {
      if (mounted) {
        _message(
          'Payment response is incomplete. Your order has not been marked as paid.',
        );
      }
      return;
    }

    if (razorpayOrderId != expectedRazorpayOrderId) {
      if (mounted) {
        _message(
          'Payment order mismatch. Your order has not been marked as paid.',
        );
      }
      return;
    }

    if (mounted) {
      setState(() => _verifyingPayment = true);
    }

    try {
      final verified = await _api.verifyRazorpayPayment(
        orderId: marketplaceOrderId,
        razorpayOrderId: razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId,
        razorpaySignature: razorpaySignature,
      );

      if (!mounted) return;

      if (verified['orderConfirmed'] != true ||
          verified['signatureVerified'] != true) {
        _message(
          'Payment could not be confirmed securely. Do not pay again until order status is checked.',
        );
        return;
      }

      _paymentMarketplaceOrderId = null;
      _paymentRazorpayOrderId = null;
      _prepareIdempotencyKey = null;

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return AlertDialog(
            backgroundColor: _surface,
            title: const Text(
              'Payment Successful',
              style: TextStyle(color: MarketplacePalette.ink),
            ),
            content: const Text(
              'Payment verified securely. Your marketplace order is confirmed.',
              style: TextStyle(color: MarketplacePalette.muted),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(),
                child: const Text('OK'),
              ),
            ],
          );
        },
      );

      if (mounted) {
        await _load();
      }
    } on MarketplaceCustomerApiException catch (error) {
      if (mounted) {
        _message(
          '${error.message} If money was deducted, do not pay again until order status is checked.',
        );
      }
    } catch (_) {
      if (mounted) {
        _message(
          'Payment verification is temporarily unavailable. If money was deducted, do not pay again.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => _verifyingPayment = false);
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;

    final message = response.message?.trim() ?? '';

    _message(
      message.isEmpty
          ? 'Payment was cancelled or failed.'
          : 'Payment failed: $message',
    );
    _recoverPayment();
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) return;

    final walletName = response.walletName?.trim() ?? '';

    _message(
      walletName.isEmpty
          ? 'External wallet selected.'
          : 'External wallet selected: $walletName',
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final cart = await _api.getCart();
      Map<String, dynamic> capabilities = {};
      try {
        capabilities = await _api.getCapabilities();
      } catch (_) {
        /* Payments remain unavailable. */
      }

      if (!mounted) return;

      setState(() {
        _cart = cart;
        _paidCheckoutEnabled = capabilities['paidCheckoutEnabled'] == true;
        _loading = false;
      });
    } on MarketplaceCustomerApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Unable to load cart. Please retry.';
      });
    }
  }

  Future<void> _changeQuantity(Map<String, dynamic> item, int quantity) async {
    final id = _text(item['id']);

    if (id.isEmpty || quantity < 1) return;

    setState(() => _workingItem = id);

    try {
      final cart = await _api.updateCartItem(itemId: id, quantity: quantity);

      if (!mounted) return;

      setState(() {
        _cart = cart;
        _prepareIdempotencyKey = null;
      });
    } on MarketplaceCustomerApiException catch (error) {
      _message(error.message);
    } finally {
      if (mounted) {
        setState(() => _workingItem = null);
      }
    }
  }

  Future<void> _remove(Map<String, dynamic> item) async {
    final id = _text(item['id']);

    if (id.isEmpty) return;

    setState(() => _workingItem = id);

    try {
      final cart = await _api.removeCartItem(itemId: id);

      if (!mounted) return;

      setState(() {
        _cart = cart;
        _prepareIdempotencyKey = null;
      });
    } on MarketplaceCustomerApiException catch (error) {
      _message(error.message);
    } finally {
      if (mounted) {
        setState(() => _workingItem = null);
      }
    }
  }

  String _newPrepareIdempotencyKey() {
    final random = Random.secure();

    final bytes = List<int>.generate(
      16,
      (_) => random.nextInt(256),
      growable: false,
    );

    final randomHex = bytes
        .map((value) => value.toRadixString(16).padLeft(2, '0'))
        .join();

    return 'mkt-${DateTime.now().microsecondsSinceEpoch}-$randomHex';
  }

  Future<void> _openRazorpayCheckout(Map<String, dynamic> order) async {
    if (_openingPayment || _verifyingPayment) return;

    final marketplaceOrderId = _text(order['id']);

    if (marketplaceOrderId.isEmpty) {
      throw const MarketplaceCustomerApiException(
        'Prepared marketplace order id is missing.',
      );
    }

    setState(() => _openingPayment = true);

    try {
      final checkout = await _api.createRazorpayOrder(
        orderId: marketplaceOrderId,
      );

      if (!mounted) return;

      final keyId = _text(checkout['keyId']);
      final razorpayOrderId = _text(checkout['razorpayOrderId']);
      final currency = _text(checkout['currency']).toUpperCase();

      final rawAmountSubunits =
          checkout['amountSubunits'] ?? checkout['razorpayAmountSubunits'];

      final amountSubunitsDouble = rawAmountSubunits is num
          ? rawAmountSubunits.toDouble()
          : double.tryParse(rawAmountSubunits?.toString() ?? '');

      if (keyId.isEmpty ||
          razorpayOrderId.isEmpty ||
          currency.isEmpty ||
          amountSubunitsDouble == null ||
          !amountSubunitsDouble.isFinite ||
          amountSubunitsDouble <= 0 ||
          amountSubunitsDouble.roundToDouble() != amountSubunitsDouble) {
        throw const MarketplaceCustomerApiException(
          'Razorpay checkout response is invalid.',
        );
      }

      final amountSubunits = amountSubunitsDouble.toInt();

      _paymentMarketplaceOrderId = marketplaceOrderId;
      _paymentRazorpayOrderId = razorpayOrderId;

      final paymentConfirmed = await _confirmServerPaymentAmount(
        checkout,
        currency,
      );

      if (!paymentConfirmed) {
        _paymentMarketplaceOrderId = null;
        _paymentRazorpayOrderId = null;
        return;
      }
      final options = <String, dynamic>{
        'key': keyId,
        'amount': amountSubunits,
        'currency': currency,
        'name': 'Astro Soul Path',
        'description': 'Marketplace Order',
        'order_id': razorpayOrderId,
        'retry': <String, dynamic>{'enabled': true, 'max_count': 1},
        'theme': <String, dynamic>{'color': '#F2C94C'},
      };

      _razorpay.open(options);
    } on MarketplaceCustomerApiException {
      rethrow;
    } catch (_) {
      throw const MarketplaceCustomerApiException(
        'Unable to open Razorpay checkout.',
      );
    } finally {
      if (mounted) {
        setState(() => _openingPayment = false);
      }
    }
  }

  Future<void> _prepareOrder() async {
    if (_preparingOrder ||
        !_paidCheckoutEnabled ||
        _paymentMarketplaceOrderId != null) {
      return;
    }

    _prepareIdempotencyKey ??= _newPrepareIdempotencyKey();

    setState(() => _preparingOrder = true);

    try {
      final addresses = await _api.getAddresses();

      if (!mounted) return;

      if (addresses.isEmpty) {
        _message('Please add a delivery address first.');

        await Navigator.of(context).push(
          MaterialPageRoute<void>(
            builder: (_) => const MarketplaceAddressScreen(),
          ),
        );

        return;
      }

      final selectedAddress = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        builder: (_) => MarketplaceAddressPicker(addresses: addresses),
      );
      if (!mounted || selectedAddress == null) return;

      final addressId = _text(selectedAddress['id']);

      if (addressId.isEmpty) {
        _message('Selected delivery address is invalid.');
        return;
      }

      final fingerprint = [
        'id',
        'fullName',
        'phone',
        'addressLine1',
        'addressLine2',
        'landmark',
        'city',
        'state',
        'postalCode',
        'countryCode',
        'country',
      ].map((key) => selectedAddress[key]?.toString() ?? '').join('\u0000');
      if (_prepareAddressFingerprint != null &&
          fingerprint != _prepareAddressFingerprint) {
        _prepareIdempotencyKey = _newPrepareIdempotencyKey();
      }
      _prepareAddressFingerprint = fingerprint;

      final idempotencyKey = _prepareIdempotencyKey;

      if (idempotencyKey == null || idempotencyKey.isEmpty) {
        throw StateError('Marketplace prepare idempotency key is missing');
      }

      final order = await _api.prepareOrder(
        addressId: addressId,
        idempotencyKey: idempotencyKey,
      );

      if (!mounted) return;

      await _openRazorpayCheckout(order);
    } on MarketplaceCustomerApiException catch (error) {
      _message(error.message);
    } finally {
      if (mounted) {
        setState(() => _preparingOrder = false);
      }
    }
  }

  void _message(String text) {
    if (!mounted) return;

    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(
        SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
      );
  }

  List<Map<String, dynamic>> get _items {
    final source = _cart['items'];

    if (source is! List) {
      return [];
    }

    return source
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList(growable: false);
  }

  @override
  Widget buildMarketplace(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () => Navigator.of(context).pop(),
          icon: Icon(
            Icons.arrow_back_rounded,
            color: Theme.of(context).colorScheme.onSurface,
          ),
        ),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        foregroundColor: Theme.of(context).colorScheme.onSurface,
        title: Text(
          'Your Cart',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontWeight: FontWeight.w700,
          ),
        ),
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
              Text(
                _error,
                textAlign: TextAlign.center,
                style: const TextStyle(color: MarketplacePalette.ink),
              ),
              const SizedBox(height: 16),
              OutlinedButton(onPressed: _load, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }

    final items = _items;

    if (items.isEmpty) {
      return const Center(
        child: Text('Your cart is empty.', style: TextStyle(color: _muted)),
      );
    }

    final currency = _text(_cart['displayCurrency']).isNotEmpty
        ? _text(_cart['displayCurrency'])
        : (_text(_cart['currency']).isEmpty ? 'INR' : _text(_cart['currency']));

    return RefreshIndicator(
      color: _gold,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 30),
        children: [
          ...items.map(_itemCard),
          const SizedBox(height: 10),
          _totals(currency),
          const SizedBox(height: 18),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: _gold,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const MarketplaceAddressScreen(),
                ),
              );
            },
            icon: const Icon(Icons.location_on_outlined),
            label: const Text('Manage Delivery Address'),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: MarketplacePalette.ink,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            onPressed:
                (!_paidCheckoutEnabled ||
                    _preparingOrder ||
                    _openingPayment ||
                    _verifyingPayment ||
                    _paymentMarketplaceOrderId != null)
                ? null
                : _prepareOrder,
            icon: _preparingOrder
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.receipt_long_outlined),
            label: Text(
              _verifyingPayment
                  ? 'Verifying Payment...'
                  : _openingPayment
                  ? 'Opening Payment...'
                  : _preparingOrder
                  ? 'Preparing Order...'
                  : !_paidCheckoutEnabled
                  ? 'Paid checkout unavailable'
                  : 'Proceed to Payment',
            ),
          ),
          const SizedBox(height: 10),
          if (_paymentMarketplaceOrderId != null)
            TextButton(
              onPressed: _recoveringPayment || _verifyingPayment
                  ? null
                  : _recoverPayment,
              child: Text(
                _recoveringPayment
                    ? 'Checking payment...'
                    : 'Check pending payment status',
              ),
            ),
          const Text(
            'Payment is confirmed only after secure server verification.',
            textAlign: TextAlign.center,
            style: TextStyle(color: _muted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _itemCard(Map<String, dynamic> item) {
    final productValue = item['product'];
    final product = productValue is Map
        ? Map<String, dynamic>.from(productValue)
        : <String, dynamic>{};

    final quantity = _int(item['quantity']);
    final stock = _int(product['stock']);
    final id = _text(item['id']);
    final working = _workingItem == id;

    String image = '';

    final images = product['images'];

    if (images is List && images.isNotEmpty && images.first is Map) {
      final first = images.first as Map;

      image = _text(first['url']).isNotEmpty
          ? _text(first['url'])
          : _text(first['imageUrl']);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 82,
            height: 82,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: MarketplacePalette.soft,
              borderRadius: BorderRadius.circular(16),
            ),
            child: image.isEmpty
                ? const Icon(Icons.inventory_2_outlined, color: _gold)
                : Image.network(
                    image,
                    fit: BoxFit.cover,
                    errorBuilder: (_, _, _) {
                      return const Icon(
                        Icons.inventory_2_outlined,
                        color: _gold,
                      );
                    },
                  ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _text(product['name']),
                  style: const TextStyle(
                    color: MarketplacePalette.ink,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _lineSubtotal(item),
                  style: const TextStyle(
                    color: _gold,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: working || quantity <= 1
                          ? null
                          : () => _changeQuantity(item, quantity - 1),
                      icon: const Icon(Icons.remove),
                      color: MarketplacePalette.ink,
                    ),
                    Text(
                      '$quantity',
                      style: const TextStyle(color: MarketplacePalette.ink),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      onPressed: working || (stock > 0 && quantity >= stock)
                          ? null
                          : () => _changeQuantity(item, quantity + 1),
                      icon: const Icon(Icons.add),
                      color: MarketplacePalette.ink,
                    ),
                    const Spacer(),
                    IconButton(
                      tooltip: 'Remove',
                      onPressed: working ? null : () => _remove(item),
                      icon: working
                          ? const SizedBox(
                              width: 17,
                              height: 17,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.delete_outline),
                      color: Colors.redAccent,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totals(String currency) {
    final subtotal = _firstMoney([
      _cart['displaySubtotal'],
      _cart['itemsSubtotal'],
      _cart['subtotal'],
    ]);

    final shipping = _firstMoney([
      _cart['displayShippingTotal'],
      _cart['shippingTotal'],
      _cart['shipping'],
    ]);

    final total = _firstMoney([
      _cart['displayGrandTotal'],
      _cart['grandTotal'],
      _cart['total'],
    ]);

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: _surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          _totalRow('Items subtotal', subtotal, currency),
          const SizedBox(height: 9),
          _totalRow('Shipping', shipping, currency),
          const Divider(height: 24),
          _totalRow('Total', total, currency, strong: true),
        ],
      ),
    );
  }

  Widget _totalRow(
    String label,
    String value,
    String currency, {
    bool strong = false,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: TextStyle(
              color: strong ? MarketplacePalette.ink : _muted,
              fontWeight: strong ? FontWeight.w800 : FontWeight.w500,
            ),
          ),
        ),
        Text(
          '${_symbol(currency)}$value',
          style: TextStyle(
            color: strong ? _gold : MarketplacePalette.ink,
            fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
          ),
        ),
      ],
    );
  }

  String _lineSubtotal(Map<String, dynamic> item) {
    final displayValue = item['displayLineSubtotal'];
    final value = displayValue ?? item['lineSubtotal'] ?? item['subtotal'];

    if (value == null) return '';

    final product = item['product'];
    String currency = 'INR';

    if (displayValue != null && _text(_cart['displayCurrency']).isNotEmpty) {
      currency = _text(_cart['displayCurrency']);
    } else if (product is Map && _text(product['currency']).isNotEmpty) {
      currency = _text(product['currency']);
    }

    return '${_symbol(currency)}${_money(value)}';
  }

  String _firstMoney(List<dynamic> values) {
    for (final value in values) {
      if (value != null) {
        return _money(value);
      }
    }

    return '0';
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

  String _paymentSymbol(String currency) {
    switch (currency.trim().toUpperCase()) {
      case 'INR':
        return '₹';
      case 'USD':
        return r'$';
      case 'GBP':
        return '£';
      case 'EUR':
        return '€';
      case 'JPY':
        return '¥';
      case 'AED':
        return 'AED ';
      case 'AUD':
        return 'A\$';
      case 'CAD':
        return 'C\$';
      case 'CHF':
        return 'CHF ';
      case 'SGD':
        return 'S\$';
      default:
        return '${currency.trim().toUpperCase()} ';
    }
  }

  Future<bool> _confirmServerPaymentAmount(
    Map<String, dynamic> checkout,
    String currency,
  ) async {
    final rawPaymentAmount = checkout['amount'];

    final paymentAmount = rawPaymentAmount is num
        ? rawPaymentAmount.toDouble()
        : double.tryParse(rawPaymentAmount?.toString() ?? '');

    if (paymentAmount == null ||
        !paymentAmount.isFinite ||
        paymentAmount <= 0) {
      throw const MarketplaceCustomerApiException(
        'Marketplace payment amount is unavailable.',
      );
    }

    final baseCurrency = _text(checkout['baseCurrency']).toUpperCase();
    final rawBaseAmount = checkout['baseAmount'];

    final baseAmount = rawBaseAmount is num
        ? rawBaseAmount.toDouble()
        : double.tryParse(rawBaseAmount?.toString() ?? '');

    final paymentText = '${_paymentSymbol(currency)}${_money(paymentAmount)}';

    String? conversionText;

    if (baseCurrency.isNotEmpty &&
        baseAmount != null &&
        baseAmount.isFinite &&
        baseAmount > 0 &&
        baseCurrency != currency) {
      conversionText =
          'Order total ${_paymentSymbol(baseCurrency)}${_money(baseAmount)} '
          'will be charged as $paymentText using the server payment quote.';
    }

    if (!mounted) return false;

    final confirmed = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Confirm payment'),
          content: Text(conversionText ?? 'You will be charged $paymentText.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text('Pay $paymentText'),
            ),
          ],
        );
      },
    );

    return confirmed == true;
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
