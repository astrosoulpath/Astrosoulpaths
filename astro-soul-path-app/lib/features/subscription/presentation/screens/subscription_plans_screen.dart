import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../wallet/data/wallet_api.dart';
import '../../data/subscription_api.dart';
import '../../models/subscription_plan.dart';
import '../widgets/horoscope_subscription_status.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../wallet/data/pending_wallet_payment_store.dart';

enum SubscriptionAudience { customer, astrologer }

class SubscriptionPlansScreen extends StatefulWidget {
  const SubscriptionPlansScreen({super.key, required this.audience});

  final SubscriptionAudience audience;

  @override
  State<SubscriptionPlansScreen> createState() =>
      _SubscriptionPlansScreenState();
}

class _SubscriptionPlansScreenState extends State<SubscriptionPlansScreen>
    with WidgetsBindingObserver {
  final SubscriptionApi _api = SubscriptionApi();
  final WalletApi _walletApi = WalletApi();

  String _razorpayKeyId = '';

  late final Razorpay _razorpay;

  bool _loading = true;
  bool _paymentInProgress = false;
  String _pendingOrderId = '';
  String _error = '';
  List<SubscriptionPlan> _plans = const [];
  final int _ownerRevision = AuthSessionStore.sessionRevision;
  late final PendingWalletPaymentStore _pendingStore;
  bool _verificationInFlight = false;
  bool get _current =>
      mounted && _ownerRevision == AuthSessionStore.sessionRevision;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pendingStore = PendingWalletPaymentStore(
      portal: widget.audience == SubscriptionAudience.customer
          ? 'customer'
          : 'astrologer',
      purpose: 'subscription',
    );

    _razorpay = Razorpay();

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);

    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);

    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);

    _initializeSubscriptionScreen();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _razorpay.clear();
    _api.close();
    _walletApi.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed &&
        _current &&
        _pendingOrderId.isNotEmpty) {
      _verifyPendingPayment();
    }
  }

  Future<void> _initializeSubscriptionScreen() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      _pendingOrderId = await _pendingStore.read() ?? '';
      final keyId = await _walletApi.getRazorpayPublicKeyId();

      if (!mounted || !_current) return;

      if (keyId.trim().isEmpty) {
        throw const WalletApiException(
          'Secure payment configuration is unavailable.',
        );
      }

      _razorpayKeyId = keyId.trim();

      final plans = await _api.getPlans();

      if (!mounted || !_current) return;

      setState(() {
        _plans = plans.where(_isAllowedPlan).toList();
      });
    } on WalletApiException catch (error) {
      if (!mounted || !_current) return;

      setState(() {
        _error = error.message;
      });
    } catch (error) {
      if (!mounted || !_current) return;

      setState(() {
        _error = error.toString();
      });
    } finally {
      if (_current) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _loadPlans() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final plans = await _api.getPlans();

      if (!mounted || !_current) return;

      setState(() {
        _plans = plans.where(_isAllowedPlan).toList();
      });
    } catch (error) {
      if (!mounted || !_current) return;

      setState(() {
        _error = error.toString();
      });
    } finally {
      if (_current) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  bool _isAllowedPlan(SubscriptionPlan plan) {
    switch (widget.audience) {
      case SubscriptionAudience.customer:
        return plan.isDailyHoroscope;
      case SubscriptionAudience.astrologer:
        return plan.isAstrologerKundli;
    }
  }

  String get _pageTitle {
    switch (widget.audience) {
      case SubscriptionAudience.customer:
        return 'Premium Plans';
      case SubscriptionAudience.astrologer:
        return 'Astrologer Subscription';
    }
  }

  String get _pageSubtitle {
    switch (widget.audience) {
      case SubscriptionAudience.customer:
        return 'Unlock personalized daily astrology guidance.';
      case SubscriptionAudience.astrologer:
        return 'Unlock professional Kundli tools and reports.';
    }
  }

  String _description(SubscriptionPlan plan) {
    if (plan.isDailyHoroscope) {
      return 'Personalized daily horoscope insights with premium access.';
    }

    if (plan.isAstrologerKundli) {
      return 'Professional Kundli tools for astrologers with yearly access.';
    }

    return 'Premium astrology subscription.';
  }

  Future<void> _subscribe(SubscriptionPlan plan) async {
    if (!_current || _paymentInProgress) return;
    if (_pendingOrderId.isNotEmpty) return _verifyPendingPayment();

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

    setState(() {
      _paymentInProgress = true;
    });

    try {
      final response = await _api.createSubscriptionOrder(plan.name);

      if (!mounted || !_current) return;

      final rawData = response['data'];

      final order = rawData is Map
          ? Map<String, dynamic>.from(rawData)
          : response;

      final orderId =
          order['id']?.toString() ??
          order['orderId']?.toString() ??
          order['razorpayOrderId']?.toString() ??
          '';

      if (!RegExp(r'^order_[A-Za-z0-9]+$').hasMatch(orderId) ||
          order['amount'] is! int ||
          (order['amount'] as int) <= 0) {
        throw const SubscriptionApiException(
          'Payment gateway did not return an order id.',
        );
      }

      _pendingOrderId = orderId;
      await _pendingStore.save(orderId);
      if (!mounted || !_current) return;
      final orderCurrency =
          order['currency']?.toString().trim().toUpperCase() ?? '';

      if (orderCurrency.isEmpty) {
        throw const SubscriptionApiException(
          'Payment gateway did not return an order currency.',
        );
      }

      final options = <String, dynamic>{
        'key': _razorpayKeyId,
        'order_id': orderId,
        'amount': order['amount'],
        'name': 'Astro Soul Path',
        'description': plan.displayTitle,
        'currency': orderCurrency,
        'theme': {'color': '#D6A84B'},
      };

      _razorpay.open(options);
    } on SubscriptionApiException catch (error) {
      if (!mounted || !_current) return;

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted || !_current) return;

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to start subscription payment.')),
      );
    }
  }

  Future<void> _handlePaymentSuccess(PaymentSuccessResponse response) =>
      _verifyPendingPayment(proof: response);

  Future<void> _verifyPendingPayment({PaymentSuccessResponse? proof}) async {
    if (!_current || _verificationInFlight) return;
    final orderId = _pendingOrderId;

    if (orderId.isEmpty) {
      if (!mounted || !_current) return;

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Payment status unavailable. Reopen subscriptions to check.',
          ),
        ),
      );

      return;
    }

    try {
      _verificationInFlight = true;
      setState(() {
        _paymentInProgress = true;
      });
      final result = proof == null
          ? await _api.reconcileOrder(orderId)
          : await _api.verifyCheckout(
              expectedOrderId: orderId,
              callbackOrderId: proof.orderId,
              paymentId: proof.paymentId,
              signature: proof.signature,
            );

      if (!mounted || !_current) return;

      final status = result['status']?.toString() ?? '';
      if (result['success'] != true ||
          !['SUCCESS', 'FAILED', 'PENDING'].contains(status.toUpperCase())) {
        throw const SubscriptionApiException(
          'Payment verification was not confirmed. Check status again.',
        );
      }
      if (status.toUpperCase() == 'SUCCESS' ||
          status.toUpperCase() == 'FAILED') {
        await _pendingStore.clear(orderId);
      }
      if (!mounted || !_current) return;

      setState(() {
        _paymentInProgress = false;
        if (status.toUpperCase() == 'SUCCESS' ||
            status.toUpperCase() == 'FAILED') {
          _pendingOrderId = '';
        }
      });

      if (status.toUpperCase() == 'SUCCESS') {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Payment verified. Subscription activated successfully.',
            ),
          ),
        );

        Navigator.of(context).pop(true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              status.toUpperCase() == 'FAILED'
                  ? 'The server confirmed this payment failed. No subscription was activated.'
                  : 'Payment verification is pending. Check this order before starting another payment.',
            ),
          ),
        );
      }
    } on SubscriptionApiException catch (error) {
      if (!mounted || !_current) return;

      setState(() {
        _paymentInProgress = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Verification pending: ${error.message}')),
      );
    } catch (_) {
      if (_current) {
        setState(() {
          _paymentInProgress = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Payment verification is unavailable. Your pending order is retained.',
            ),
          ),
        );
      }
    } finally {
      _verificationInFlight = false;
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    if (!mounted || !_current) return;

    setState(() {
      _paymentInProgress = false;
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Checkout closed. Check the existing payment status before retrying.',
        ),
      ),
    );
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    if (!mounted || !_current) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'External wallet selected: '
          '${response.walletName ?? 'wallet'}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        elevation: 0,
        title: Text(
          _pageTitle,
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadPlans,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
            children: [
              if (_pendingOrderId.isNotEmpty) ...[
                const Text(
                  'An earlier payment is awaiting verification. No new payment will be started until its status is confirmed.',
                ),
                TextButton(
                  onPressed: _paymentInProgress ? null : _verifyPendingPayment,
                  child: const Text('Check payment status'),
                ),
              ],
              if (widget.audience == SubscriptionAudience.customer)
                const HoroscopeSubscriptionStatus(),
              const Icon(
                Icons.workspace_premium_rounded,
                color: AppColors.gold,
                size: 56,
              ),
              const SizedBox(height: 16),
              Text(
                _pageTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _pageSubtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 15,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 28),
              if (_loading)
                const Padding(
                  padding: EdgeInsets.only(top: 48),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.gold),
                  ),
                )
              else if (_error.isNotEmpty)
                _ErrorCard(
                  message: _error,
                  onRetry: _initializeSubscriptionScreen,
                )
              else if (_plans.isEmpty)
                const _EmptyCard()
              else
                ..._plans.map(
                  (plan) => Padding(
                    padding: const EdgeInsets.only(bottom: 18),
                    child: _PlanCard(
                      plan: plan,
                      description: _description(plan),
                      onSubscribe: () => _subscribe(plan),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.description,
    required this.onSubscribe,
  });

  final SubscriptionPlan plan;
  final String description;
  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
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
          Row(
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: const Icon(
                  Icons.auto_awesome_rounded,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  plan.displayTitle,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          Text(
            plan.priceLabel,
            style: const TextStyle(
              color: AppColors.gold,
              fontWeight: FontWeight.w900,
              fontSize: 28,
            ),
          ),
          const SizedBox(height: 5),
          Text(
            '${plan.durationDays}-day access',
            style: const TextStyle(
              color: AppColors.muted,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            description,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 14,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            height: 52,
            child: FilledButton(
              onPressed: onSubscribe,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: AppColors.background,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: const Text(
                'Subscribe Now',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.gold, size: 40),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.white),
          ),
          const SizedBox(height: 16),
          OutlinedButton(onPressed: onRetry, child: const Text('Retry')),
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Column(
        children: [
          Icon(Icons.info_outline_rounded, color: AppColors.gold),
          SizedBox(height: 12),
          Text(
            'No active subscription plan is available right now.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.white),
          ),
        ],
      ),
    );
  }
}
