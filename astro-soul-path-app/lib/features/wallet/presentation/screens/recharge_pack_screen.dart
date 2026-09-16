import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import 'package:astro_soul_path/core/theme/app_theme.dart';
import 'package:astro_soul_path/features/wallet/data/customer_wallet.dart';
import 'package:astro_soul_path/features/wallet/data/recharge_pack.dart';
import 'package:astro_soul_path/features/wallet/data/wallet_api.dart';

class RechargePackScreen extends StatefulWidget {
  const RechargePackScreen({super.key});

  @override
  State<RechargePackScreen> createState() => _RechargePackScreenState();
}

class _RechargePackScreenState extends State<RechargePackScreen> {
  final WalletApi _walletApi = WalletApi();
  late final Razorpay _razorpay;

  List<RechargePack> _packs = const [];
  RechargePack? _selectedPack;
  CustomerWallet? _wallet;

  bool _loading = true;
  String? _error;
  bool _paymentLoading = false;
  bool _customAmountExpanded = false;
  final TextEditingController _customAmountController = TextEditingController();
  String? _pendingRazorpayOrderId;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _loadPacks();
  }

  Future<void> _loadPacks() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final results = await Future.wait([
        _walletApi.getWallet(),
        _walletApi.getRechargePacks(),
      ]);

      final wallet = results[0] as CustomerWallet;
      final packs = results[1] as List<RechargePack>;

      if (!mounted) {
        return;
      }

      setState(() {
        _wallet = wallet;
        _packs = packs;
        _selectedPack = null;
        _loading = false;
      });
    } on WalletApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = 'Unable to load recharge packs. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _customAmountController.dispose();
    _razorpay.clear();
    _walletApi.close();
    super.dispose();
  }

  Future<void> _startCustomAmountPayment(double rechargeAmount) async {
    if (_paymentLoading) {
      return;
    }

    setState(() {
      _paymentLoading = true;
    });

    try {
      final keyId = await _walletApi.getRazorpayPublicKeyId();
      final order = await _walletApi.createRechargeOrder(rechargeAmount);

      if (!mounted) return;

      final orderId = order['id']?.toString().trim() ?? '';
      final rawAmount = order['amount'];

      final amount = rawAmount is num
          ? rawAmount.toInt()
          : int.tryParse(rawAmount?.toString() ?? '');

      final currency = order['currency']?.toString().trim().isNotEmpty == true
          ? order['currency'].toString().trim().toUpperCase()
          : 'INR';

      if (orderId.isEmpty || amount == null || amount <= 0) {
        throw const WalletApiException(
          'Invalid payment order returned by server.',
        );
      }

      setState(() {
        _pendingRazorpayOrderId = orderId;
      });

      _razorpay.open({
        'key': keyId,
        'order_id': orderId,
        'amount': amount,
        'currency': currency,
        'name': 'Astro Soul Path',
        'description': 'Wallet Recharge',
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _paymentLoading = false;
        _pendingRazorpayOrderId = null;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _startPayment() async {
    final pack = _selectedPack;

    if (pack == null || _paymentLoading) {
      return;
    }

    setState(() {
      _paymentLoading = true;
    });

    try {
      final keyId = await _walletApi.getRazorpayPublicKeyId();
      final order = await _walletApi.createRechargePackOrder(pack.id);

      if (!mounted) return;

      final orderId = order['id']?.toString().trim() ?? '';
      final rawAmount = order['amount'];
      final amount = rawAmount is num
          ? rawAmount.toInt()
          : int.tryParse(rawAmount?.toString() ?? '');
      final currency = order['currency']?.toString().trim().isNotEmpty == true
          ? order['currency'].toString().trim().toUpperCase()
          : 'INR';

      if (orderId.isEmpty || amount == null || amount <= 0) {
        throw const WalletApiException(
          'Invalid payment order returned by server.',
        );
      }

      setState(() {
        _pendingRazorpayOrderId = orderId;
      });

      _razorpay.open({
        'key': keyId,
        'order_id': orderId,
        'amount': amount,
        'currency': currency,
        'name': 'Astro Soul Path',
        'description': 'Wallet Recharge',
      });
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _paymentLoading = false;
        _pendingRazorpayOrderId = null;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final orderId = response.orderId?.trim().isNotEmpty == true
        ? response.orderId!.trim()
        : _pendingRazorpayOrderId;

    if (orderId == null || orderId.isEmpty) {
      if (!mounted) return;

      setState(() {
        _paymentLoading = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment received, but verification is pending.'),
        ),
      );
      return;
    }

    try {
      final result = await _walletApi.reconcileOrder(orderId);

      if (!mounted) return;

      final status = result['status']?.toString().toLowerCase();

      setState(() {
        _paymentLoading = false;
        _pendingRazorpayOrderId = null;
      });

      if (status == 'success') {
        Navigator.of(context).pop(true);
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Payment verification is still pending.')),
      );
    } catch (error) {
      if (!mounted) return;

      setState(() {
        _paymentLoading = false;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.toString())));
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) return;

    setState(() {
      _paymentLoading = false;
      _pendingRazorpayOrderId = null;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(response.message ?? 'Payment was not completed.')),
    );
  }

  String _money(double value) {
    final amount = value == value.roundToDouble()
        ? value.toInt().toString()
        : value.toStringAsFixed(2);

    return '\u20B9$amount';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Select Recharge Pack',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(onRefresh: _loadPacks, child: _buildBody()),
      ),
      bottomNavigationBar: _selectedPack == null
          ? null
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                child: FilledButton(
                  onPressed: _paymentLoading ? null : _startPayment,
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(54),
                    backgroundColor: AppColors.gold,
                    foregroundColor: AppColors.background,
                  ),
                  child: Text(
                    'Continue with ${_money(_selectedPack!.amount)}',
                    style: const TextStyle(fontWeight: FontWeight.w900),
                  ),
                ),
              ),
            ),
    );
  }

  Widget _buildCustomAmountSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () {
                setState(() {
                  _customAmountExpanded = !_customAmountExpanded;
                });
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Enter your amount',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    Icon(
                      _customAmountExpanded
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      color: AppColors.gold,
                    ),
                  ],
                ),
              ),
            ),
            if (_customAmountExpanded) ...[
              const Divider(height: 1, color: AppColors.border),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _customAmountController,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                        decoration: InputDecoration(
                          hintText: 'Minimum Recharge \u20B950',
                          prefixText: '\u20B9 ',
                          hintStyle: const TextStyle(color: AppColors.muted),
                          prefixStyle: const TextStyle(
                            color: AppColors.gold,
                            fontWeight: FontWeight.w800,
                          ),
                          filled: true,
                          fillColor: Colors.black,
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(
                              color: AppColors.border,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10),
                            borderSide: const BorderSide(color: AppColors.gold),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: _paymentLoading
                            ? null
                            : () async {
                                final value = double.tryParse(
                                  _customAmountController.text.trim(),
                                );

                                if (value == null || value < 50) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Minimum recharge amount is \u20B950.',
                                      ),
                                    ),
                                  );
                                  return;
                                }

                                await _startCustomAmountPayment(value);
                              },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.gold,
                          foregroundColor: Colors.black,
                        ),
                        child: const Text(
                          'Proceed',
                          style: TextStyle(fontWeight: FontWeight.w900),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: [
          const SizedBox(height: 90),
          const Icon(
            Icons.error_outline_rounded,
            color: AppColors.gold,
            size: 46,
          ),
          const SizedBox(height: 16),
          Text(
            _error!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, fontSize: 14),
          ),
          const SizedBox(height: 18),
          Center(
            child: OutlinedButton(
              onPressed: _loadPacks,
              child: const Text('Try Again'),
            ),
          ),
        ],
      );
    }

    if (_packs.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 100),
          Icon(
            Icons.account_balance_wallet_outlined,
            color: AppColors.gold,
            size: 52,
          ),
          SizedBox(height: 18),
          Text(
            'No recharge packs are available right now.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Please check again later.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, fontSize: 13),
          ),
        ],
      );
    }

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF171717),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Available Balance',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          _money(_wallet!.availableBalance),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 7),
                        Text(
                          'Paid: ${_money(_wallet!.paidBalance)}  |  Free: ${_money(_wallet!.freeBalance)}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.account_balance_wallet_outlined,
                      color: AppColors.gold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        SliverToBoxAdapter(child: _buildCustomAmountSection()),
        const SliverPadding(
          padding: EdgeInsets.fromLTRB(16, 18, 16, 8),
          sliver: SliverToBoxAdapter(
            child: Text(
              'Choose your recharge amount',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 24),
          sliver: SliverGrid(
            delegate: SliverChildBuilderDelegate((context, index) {
              final pack = _packs[index];
              final selected = _selectedPack?.id == pack.id;
              final hasBonus = pack.bonusPercent > 0;

              final bonusText = hasBonus
                  ? '${pack.bonusPercent == pack.bonusPercent.roundToDouble() ? pack.bonusPercent.toInt() : pack.bonusPercent.toStringAsFixed(1)}% Extra'
                  : 'Base Pack';

              return Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(14),
                  onTap: () {
                    setState(() {
                      _selectedPack = pack;
                    });
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.gold.withValues(alpha: 0.10)
                          : const Color(0xFF171717),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: selected
                            ? AppColors.gold
                            : Colors.white.withValues(alpha: 0.14),
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(13),
                      child: Column(
                        children: [
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 7,
                            ),
                            color: hasBonus
                                ? AppColors.gold
                                : Colors.white.withValues(alpha: 0.08),
                            child: Text(
                              bonusText,
                              textAlign: TextAlign.center,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: hasBonus
                                    ? AppColors.background
                                    : AppColors.muted,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Center(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 4,
                                ),
                                child: Text(
                                  _money(pack.amount),
                                  maxLines: 1,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 20,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ),
                            ),
                          ),
                          if (pack.bonusAmount > 0)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(4, 0, 4, 9),
                              child: Text(
                                'Get ${_money(pack.creditAmount)}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  color: AppColors.gold,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }, childCount: _packs.length),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 10,
              mainAxisSpacing: 12,
              childAspectRatio: 0.92,
            ),
          ),
        ),
      ],
    );
  }
}
