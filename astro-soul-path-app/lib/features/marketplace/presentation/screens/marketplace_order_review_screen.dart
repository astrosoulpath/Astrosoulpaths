import '../marketplace_private_state.dart';
import 'dart:math';
import 'package:flutter/material.dart';
import '../../data/marketplace_customer_api.dart';
import '../../data/marketplace_money.dart';

class MarketplaceOrderReviewScreen extends StatefulWidget {
  const MarketplaceOrderReviewScreen({super.key, required this.orderId});
  final String orderId;
  @override
  State<MarketplaceOrderReviewScreen> createState() =>
      _MarketplaceOrderReviewScreenState();
}

class _MarketplaceOrderReviewScreenState
    extends MarketplacePrivateState<MarketplaceOrderReviewScreen> {
  final _api = MarketplaceCustomerApi();
  final _reason = TextEditingController();
  final _amount = TextEditingController();
  String _kind = 'REFUND';
  String? _key;
  Map<String, dynamic>? _pending;
  bool _busy = false;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _cases = [];
  String _caseAmount(Map<String, dynamic> row) {
    final minor = int.tryParse(row['amountMinor'].toString());
    if (minor == null || minor < 0) return 'Unavailable';
    return marketplaceMoney(
      '${minor ~/ 100}.${(minor % 100).toString().padLeft(2, '0')}',
      row['currency'].toString(),
    );
  }

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.dispose();
    _reason.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final rows = await _api.getCases();
      if (mounted) {
        setState(() {
          _cases = rows.where((r) => r['orderId'] == widget.orderId).toList();
          _loading = false;
          _error = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _cases = [];
          _loading = false;
          _error = 'Review requests unavailable. Please refresh.';
        });
      }
    }
  }

  Future<void> _submit() async {
    if (_busy) return;
    final raw = _amount.text.trim();
    final valid = RegExp(r'^\d{1,8}(?:\.\d{1,2})?$').hasMatch(raw);
    final pieces = raw.split('.');
    final minor = valid
        ? int.parse(pieces[0]) * 100 +
              int.parse((pieces.length == 2 ? pieces[1] : '').padRight(2, '0'))
        : 0;
    if (_reason.text.trim().length < 5 ||
        (_kind == 'REFUND' && (minor < 1 || minor > 2147483647))) {
      setState(() => _error = 'Enter a reason and a valid INR refund amount.');
      return;
    }
    final payload = <String, dynamic>{
      'kind': _kind,
      'reason': _reason.text.trim(),
      if (_kind == 'REFUND') 'amountMinor': minor,
    };
    if (_pending != null && _pending.toString() != payload.toString()) {
      setState(
        () => _error =
            'Verify your previous request before submitting a different request.',
      );
      return;
    }
    _key ??= List.generate(
      24,
      (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0'),
    ).join();
    _pending = payload;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await _api.createCase(widget.orderId, {
        ...payload,
        'idempotencyKey': _key,
      });
      if (!mounted) return;
      _key = null;
      _pending = null;
      _reason.clear();
      _amount.clear();
      await _load();
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Request could not be confirmed. Refresh first; retry the same request if needed.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget buildMarketplace(BuildContext context) => Scaffold(
    backgroundColor: const Color(0xFFFFF8F1),
    appBar: AppBar(title: const Text('Order review')),
    body: RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(20),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const Text(
            'Refund and dispute requests',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 12),
          const Text(
            'Requests are reviewed by support. Approval does not confirm that money has been returned. Refund payments are currently unavailable.',
          ),
          if (_loading) const LinearProgressIndicator(),
          if (_error != null)
            Text(_error!, style: const TextStyle(color: Colors.red)),
          ..._cases.map(
            (row) => Card(
              child: ListTile(
                title: Text('${row['kind']} · ${row['status']}'),
                subtitle: Text(
                  row['amountMinor'] == null ? 'Review only' : _caseAmount(row),
                ),
              ),
            ),
          ),
          DropdownButtonFormField<String>(
            initialValue: _kind,
            items: const [
              DropdownMenuItem(value: 'REFUND', child: Text('Refund review')),
              DropdownMenuItem(value: 'DISPUTE', child: Text('Dispute')),
            ],
            onChanged: _busy ? null : (v) => setState(() => _kind = v!),
          ),
          if (_kind == 'REFUND')
            TextField(
              controller: _amount,
              enabled: !_busy,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Requested amount (INR)',
              ),
            ),
          TextField(
            controller: _reason,
            enabled: !_busy,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Reason — no payment credentials',
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy || _loading ? null : _submit,
            child: Text(_busy ? 'Submitting...' : 'Submit review request'),
          ),
        ],
      ),
    ),
  );
}
