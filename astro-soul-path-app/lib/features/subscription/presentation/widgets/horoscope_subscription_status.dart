import 'package:flutter/material.dart';
import '../../data/subscription_api.dart';

class HoroscopeSubscriptionStatus extends StatefulWidget {
  const HoroscopeSubscriptionStatus({super.key, this.load, this.cancel});
  final Future<Map<String, dynamic>?> Function()? load;
  final Future<void> Function()? cancel;
  @override
  State<HoroscopeSubscriptionStatus> createState() =>
      _HoroscopeSubscriptionStatusState();
}

class _HoroscopeSubscriptionStatusState
    extends State<HoroscopeSubscriptionStatus> {
  final _api = SubscriptionApi();
  Map<String, dynamic>? _data;
  bool _busy = true;
  String? _error;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _busy = true;
        _error = null;
      });
    }
    try {
      final result = await (widget.load ?? _api.getCurrentSubscription)();
      if (mounted) setState(() => _data = result);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Subscription status unavailable. No payment or cancellation is assumed.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel at period end?'),
        content: const Text(
          'Keep paid access until the expiry shown. This does not request a refund. Automatic billing is not enabled for this manual plan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Keep subscription'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm cancellation'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      if (widget.cancel != null) {
        await widget.cancel!();
      } else {
        await _api.cancelAtPeriodEnd(
          expectedUserId: _data?['userId']?.toString(),
        );
      }
      await _load();
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error =
              'Cancellation was not confirmed. Refresh status before retrying.';
        });
      }
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final plan = _data?['subscriptionPlan'];
    final daily = plan is Map && plan['name'] == 'DAILY_HOROSCOPE_MONTHLY';
    final billing = _data?['billing'];
    final info = billing is Map ? billing : const {};
    final expiry = DateTime.tryParse(_data?['endDate']?.toString() ?? '');
    final expired = expiry != null && !expiry.isAfter(DateTime.now());
    final status = expired && _data?['subscriptionStatus'] == 'ACTIVE'
        ? 'EXPIRED'
        : _data?['subscriptionStatus']?.toString() ?? 'NONE';
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Your horoscope subscription',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            if (_busy)
              const LinearProgressIndicator()
            else if (_error != null)
              Text(_error!)
            else if (!daily)
              const Text(
                'No daily horoscope subscription returned by the server.',
              )
            else ...[
              Text('Status: $status'),
              Text(
                expiry == null
                    ? 'Expiry unavailable'
                    : 'Paid expiry (local time): ${expiry.toLocal()}',
              ),
              Text(
                info['renewalMode'] == 'MANUAL'
                    ? 'Manual renewal. Choose the \$1 / 30-day plan below after expiry.'
                    : 'Automatic renewal: not verified or available here.',
              ),
              if (status == 'PENDING' || status == 'FAILED')
                const Text('Payment is not confirmed. Access is not assumed.'),
              if (info['cancelAtPeriodEnd'] == true)
                const Text(
                  'Period-end cancellation requested. Paid access remains until expiry.',
                ),
              const Text(
                'Refund status: unavailable from this API. Cancellation is not a refund.',
              ),
              if (status == 'ACTIVE' &&
                  info['cancelAtPeriodEnd'] != true &&
                  info['periodEndCancellationSupported'] == true)
                TextButton(
                  onPressed: _cancel,
                  child: const Text('Cancel at period end'),
                ),
            ],
            if (!_busy)
              TextButton(
                onPressed: _load,
                child: const Text('Refresh subscription status'),
              ),
          ],
        ),
      ),
    );
  }
}
