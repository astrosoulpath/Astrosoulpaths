import 'package:flutter/material.dart';

import 'recharge_pack_screen.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/customer_wallet.dart';
import '../../data/wallet_api.dart';
import '../../data/wallet_history_api.dart';
import '../../data/wallet_transaction.dart';

class CustomerWalletScreen extends StatefulWidget {
  const CustomerWalletScreen({super.key, this.returnAfterRecharge = false});

  final bool returnAfterRecharge;

  @override
  State<CustomerWalletScreen> createState() => _CustomerWalletScreenState();
}

class _CustomerWalletScreenState extends State<CustomerWalletScreen> {
  static const String _razorpayKeyId = String.fromEnvironment(
    'RAZORPAY_KEY_ID',
  );

  final WalletApi _walletApi = WalletApi();
  final WalletHistoryApi _historyApi = WalletHistoryApi();

  late final Razorpay _razorpay;

  bool _paymentInProgress = false;
  String _pendingOrderId = '';

  CustomerWallet? _wallet;
  List<WalletTransaction> _transactions = <WalletTransaction>[];

  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();

    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);

    _loadWallet();
  }

  @override
  void dispose() {
    _razorpay.clear();
    _walletApi.close();
    _historyApi.close();
    super.dispose();
  }

  Future<void> _loadWallet() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }

    try {
      final walletFuture = _walletApi.getWallet();
      final historyFuture = _historyApi.getHistory();

      final CustomerWallet wallet = await walletFuture;
      final transactions = await historyFuture;

      if (!mounted) {
        return;
      }

      setState(() {
        _wallet = wallet;
        _transactions = transactions;
        _loading = false;
      });
    } on WalletApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = 'Wallet could not be loaded.';
      });
    }
  }

  Future<void> _openPremiumRecharge() async {
    final recharged = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(builder: (_) => const RechargePackScreen()),
    );

    if (!mounted) {
      return;
    }

    if (recharged == true) {
      await _loadWallet();

      if (!mounted) {
        return;
      }

      if (widget.returnAfterRecharge) {
        Navigator.of(context).pop(true);
      }
    }
  }

  Future<void> _startRecharge() async {
    if (_paymentInProgress) {
      return;
    }

    if (_razorpayKeyId.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Razorpay public key is not configured for this build.',
          ),
        ),
      );
      return;
    }

    String amountText = '';

    final amount = await showDialog<double>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.surfaceLight,
          title: const Text(
            'Add money',
            style: TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w900,
            ),
          ),
          content: TextField(
            onChanged: (value) => amountText = value,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            style: const TextStyle(color: AppColors.white),
            decoration: const InputDecoration(
              prefixText: '\u20B9 ',
              prefixStyle: TextStyle(color: AppColors.gold),
              hintText: 'Enter amount',
              hintStyle: TextStyle(color: AppColors.muted),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () {
                final parsed = double.tryParse(amountText.trim());

                if (parsed == null || parsed < 1) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Enter an amount of at least \u20B91.'),
                    ),
                  );
                  return;
                }

                Navigator.of(dialogContext).pop(parsed);
              },
              child: const Text('Continue'),
            ),
          ],
        );
      },
    );

    if (amount == null || !mounted) {
      return;
    }

    setState(() {
      _paymentInProgress = true;
    });

    try {
      final response = await _walletApi.createRechargeOrder(amount);

      if (!mounted) {
        return;
      }

      final rawData = response['data'];

      final order = rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : response;

      final orderId =
          order['id']?.toString() ??
          order['orderId']?.toString() ??
          order['razorpayOrderId']?.toString() ??
          '';

      if (orderId.isEmpty) {
        throw const WalletApiException(
          'Payment gateway did not return an order id.',
        );
      }

      final currency = order['currency']?.toString().trim().toUpperCase() ?? '';

      if (currency.isEmpty) {
        throw const WalletApiException(
          'Payment gateway did not return order currency.',
        );
      }

      _pendingOrderId = orderId;

      final options = <String, dynamic>{
        'key': _razorpayKeyId,
        'order_id': orderId,
        'name': 'Astro Soul Path',
        'description': 'Wallet Recharge',
        'currency': currency,
        'theme': {'color': '#D6A84B'},
      };

      _razorpay.open(options);
    } on WalletApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to start wallet recharge.')),
      );
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) async {
    final responseOrderId = response.orderId?.trim() ?? '';

    final orderId = responseOrderId.isNotEmpty
        ? responseOrderId
        : _pendingOrderId;

    if (orderId.isEmpty) {
      if (!mounted) {
        return;
      }

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Payment succeeded. Verification is still pending.'),
        ),
      );

      return;
    }

    try {
      await _walletApi.reconcileOrder(orderId);

      await _loadWallet();

      if (!mounted) {
        return;
      }

      setState(() {
        _paymentInProgress = false;
        _pendingOrderId = '';
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Wallet recharge verified successfully.')),
      );
    } on WalletApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Payment received. ${error.message}')),
      );
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted) {
      return;
    }

    setState(() {
      _paymentInProgress = false;
      _pendingOrderId = '';
    });

    final message = response.message?.trim();

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message == null || message.isEmpty
              ? 'Payment was not completed.'
              : message,
        ),
      ),
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted) {
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'External wallet selected. Complete payment to continue.',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text(
          'My Wallet',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh wallet',
            onPressed: _loading ? null : _loadWallet,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading && _wallet == null) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.gold),
      );
    }

    if (_error != null && _wallet == null) {
      return _WalletMessage(
        icon: Icons.account_balance_wallet_outlined,
        title: 'Could not load wallet',
        message: _error!,
        buttonLabel: 'Try Again',
        onPressed: _loadWallet,
      );
    }

    final wallet = _wallet;

    if (wallet == null) {
      return const _WalletMessage(
        icon: Icons.account_balance_wallet_outlined,
        title: 'Wallet unavailable',
        message: 'Your wallet information is not available.',
      );
    }

    return RefreshIndicator(
      color: AppColors.gold,
      onRefresh: _loadWallet,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: _WalletBalanceCard(
              wallet: wallet,
              onRecharge: () {
                _openPremiumRecharge();
              },
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Recent Transactions',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                  Text(
                    '${_transactions.length}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_transactions.isEmpty)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: _WalletMessage(
                icon: Icons.receipt_long_outlined,
                title: 'No transactions yet',
                message:
                    'Verified recharges and consultation payments '
                    'will appear here.',
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(18, 0, 18, 30),
              sliver: SliverList.separated(
                itemCount: _transactions.length,
                separatorBuilder: (_, _) => const SizedBox(height: 10),
                itemBuilder: (context, index) {
                  return _TransactionCard(
                    transaction: _transactions[index],
                    currency: wallet.currency,
                  );
                },
              ),
            ),
        ],
      ),
    );
  }
}

class _WalletBalanceCard extends StatelessWidget {
  const _WalletBalanceCard({required this.wallet, required this.onRecharge});

  final CustomerWallet wallet;
  final VoidCallback onRecharge;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(18, 18, 18, 0),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.surfaceLight, AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(26),
        border: Border.all(color: AppColors.border),
        boxShadow: const [
          BoxShadow(
            color: Color(0x33000000),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.account_balance_wallet_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Text(
                'Available Balance',
                style: TextStyle(
                  color: AppColors.muted,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            _amount(wallet.availableBalance, wallet.currency),
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 38,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _BalanceDetail(
                  label: 'Total balance',
                  value: _amount(wallet.balance, wallet.currency),
                ),
              ),
              Expanded(
                child: _BalanceDetail(
                  label: 'Reserved',
                  value: _amount(wallet.lockedBalance, wallet.currency),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const RechargePackScreen(),
                ),
              );
            },
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(54),
              backgroundColor: AppColors.gold,
              foregroundColor: AppColors.background,
            ),
            icon: const Icon(Icons.add_rounded),
            label: const Text(
              'Add Money Securely',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
          ),
          const SizedBox(height: 10),
          const Text(
            'Balance is credited only after backend payment verification.',
            style: TextStyle(color: AppColors.muted, fontSize: 11, height: 1.4),
          ),
        ],
      ),
    );
  }
}

class _BalanceDetail extends StatelessWidget {
  const _BalanceDetail({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: AppColors.muted, fontSize: 12),
        ),
        const SizedBox(height: 5),
        Text(
          value,
          style: const TextStyle(
            color: AppColors.white,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _TransactionCard extends StatelessWidget {
  const _TransactionCard({required this.transaction, required this.currency});

  final WalletTransaction transaction;
  final String currency;

  @override
  Widget build(BuildContext context) {
    final credit = transaction.isCredit;
    final color = credit ? const Color(0xFF77E39B) : const Color(0xFFFFA36C);

    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.13),
              shape: BoxShape.circle,
            ),
            child: Icon(
              credit ? Icons.south_west_rounded : Icons.north_east_rounded,
              color: color,
            ),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  transaction.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  _date(transaction.createdAt),
                  style: const TextStyle(color: AppColors.muted, fontSize: 12),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          Text(
            '${credit ? '+' : '-'}'
            '${_amount(transaction.amount, currency)}',
            style: TextStyle(color: color, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }
}

class _WalletMessage extends StatelessWidget {
  const _WalletMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.buttonLabel,
    this.onPressed,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? buttonLabel;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 54, color: AppColors.gold),
            const SizedBox(height: 15),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 19,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.muted, height: 1.5),
            ),
            if (buttonLabel != null && onPressed != null) ...[
              const SizedBox(height: 18),
              FilledButton(onPressed: onPressed, child: Text(buttonLabel!)),
            ],
          ],
        ),
      ),
    );
  }
}

String _amount(double value, String currency) {
  final formatted = value == value.roundToDouble()
      ? value.toInt().toString()
      : value.toStringAsFixed(2);

  return switch (currency.toUpperCase()) {
    'USD' => '\$$formatted',
    'INR' => '\u20B9$formatted',
    _ => '${currency.toUpperCase()} $formatted',
  };
}

String _date(DateTime? source) {
  if (source == null) {
    return 'Date unavailable';
  }

  final date = source.toLocal();
  final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
  final minute = date.minute.toString().padLeft(2, '0');
  final period = date.hour >= 12 ? 'PM' : 'AM';

  return '${date.day}/${date.month}/${date.year}'
      ' \u2022 $hour:$minute $period';
}
