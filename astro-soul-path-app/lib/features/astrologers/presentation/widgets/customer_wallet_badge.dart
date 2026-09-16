import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

import '../../../../core/config/api_config.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';

class CustomerWalletBadge extends StatefulWidget {
  const CustomerWalletBadge({super.key});

  @override
  State<CustomerWalletBadge> createState() => _CustomerWalletBadgeState();
}

class _CustomerWalletBadgeState extends State<CustomerWalletBadge> {
  final _sessionStore = AuthSessionStore();
  final _client = http.Client();

  double? _balance;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _client.close();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final session = await _sessionStore.read();
      final token = session?.accessToken.trim() ?? '';

      if (token.isEmpty) {
        if (mounted) {
          setState(() {
            _loading = false;
          });
        }
        return;
      }

      final response = await _client
          .get(
            Uri.parse('${ApiConfig.baseUrl}/wallet'),
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer $token',
            },
          )
          .timeout(ApiConfig.requestTimeout);

      if (response.statusCode < 200 || response.statusCode >= 300) {
        if (mounted) {
          setState(() {
            _loading = false;
          });
        }
        return;
      }

      final decoded = jsonDecode(response.body);

      if (decoded is! Map) {
        return;
      }

      final root = Map<String, dynamic>.from(decoded);
      final rawData = root['data'];

      if (rawData is! Map) {
        return;
      }

      final data = Map<String, dynamic>.from(rawData);

      final rawBalance = data['availableBalance'] ?? data['balance'];

      final balance = rawBalance is num
          ? rawBalance.toDouble()
          : double.tryParse(rawBalance?.toString() ?? '');

      if (!mounted) {
        return;
      }

      setState(() {
        _balance = balance;
        _loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  String _money(double value) {
    if (value == value.roundToDouble()) {
      return value.toInt().toString();
    }

    return value.toStringAsFixed(2);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Padding(
        padding: EdgeInsets.symmetric(horizontal: 10),
        child: Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.gold,
            ),
          ),
        ),
      );
    }

    if (_balance == null) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.account_balance_wallet_rounded,
            size: 15,
            color: AppColors.gold,
          ),
          const SizedBox(width: 5),
          Text(
            '₹${_money(_balance!)}',
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 12,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
