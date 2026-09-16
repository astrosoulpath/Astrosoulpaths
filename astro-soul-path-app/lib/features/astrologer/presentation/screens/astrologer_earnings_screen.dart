import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_portal_api.dart';

class AstrologerEarningsScreen extends StatefulWidget {
  const AstrologerEarningsScreen({super.key});

  @override
  State<AstrologerEarningsScreen> createState() =>
      _AstrologerEarningsScreenState();
}

class _AstrologerEarningsScreenState extends State<AstrologerEarningsScreen> {
  final _api = AstrologerPortalApi();
  final _sessionStore = AuthSessionStore();

  bool _loading = true;
  bool _payoutSubmitting = false;
  String _error = '';

  Map<String, dynamic> _summary = {};
  Map<String, dynamic>? _bankAccount;

  List<Map<String, dynamic>> _transactions = [];
  List<Map<String, dynamic>> _payouts = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
        );
      }

      final results = await Future.wait([
        _api.getEarningsSummary(accessToken: token),
        _api.getEarningsTransactions(accessToken: token),
        _api.getPayoutBankAccount(accessToken: token),
        _api.getPayoutHistory(accessToken: token),
      ]);

      final summaryData = results[0]['data'];
      final transactionData = results[1]['data'];
      final bankData = results[2]['data'];
      final payoutData = results[3]['data'];

      final summary = summaryData is Map
          ? Map<String, dynamic>.from(summaryData)
          : <String, dynamic>{};

      final transactions = <Map<String, dynamic>>[];

      if (transactionData is Map) {
        final raw = transactionData['transactions'] ?? transactionData['items'];

        if (raw is List) {
          for (final item in raw) {
            if (item is Map) {
              transactions.add(Map<String, dynamic>.from(item));
            }
          }
        }
      }

      Map<String, dynamic>? bankAccount;

      if (bankData is Map) {
        bankAccount = Map<String, dynamic>.from(bankData);
      }

      final payouts = <Map<String, dynamic>>[];

      if (payoutData is List) {
        for (final item in payoutData) {
          if (item is Map) {
            payouts.add(Map<String, dynamic>.from(item));
          }
        }
      } else if (payoutData is Map) {
        final raw = payoutData['payouts'] ?? payoutData['items'];

        if (raw is List) {
          for (final item in raw) {
            if (item is Map) {
              payouts.add(Map<String, dynamic>.from(item));
            }
          }
        }
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _summary = summary;
        _transactions = transactions;
        _bankAccount = bankAccount;
        _payouts = payouts;
      });
    } on AstrologerPortalApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to load earnings and payout details.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  double _amount(String key) {
    return double.tryParse(_summary[key]?.toString() ?? '') ?? 0;
  }

  String _money(String key) {
    return '₹${_amount(key).toStringAsFixed(2)}';
  }

  String _valueMoney(dynamic value) {
    final amount = double.tryParse(value?.toString() ?? '') ?? 0;

    return '₹${amount.toStringAsFixed(2)}';
  }

  Future<void> _showBankAccountDialog() async {
    final holderController = TextEditingController(
      text: _bankAccount?['accountHolderName']?.toString() ?? '',
    );

    final accountController = TextEditingController();

    final ifscController = TextEditingController(
      text: _bankAccount?['ifsc']?.toString() ?? '',
    );

    final bankController = TextEditingController(
      text: _bankAccount?['bankName']?.toString() ?? '',
    );

    bool saving = false;
    String localError = '';

    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.surface,
              title: Text(
                _bankAccount == null
                    ? 'Add payout bank account'
                    : 'Change payout bank account',
                style: const TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_bankAccount != null) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.background.withValues(alpha: 0.40),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Current: '
                          '${_bankAccount?['maskedAccountNumber'] ?? ''}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                    ],
                    _BankField(
                      controller: holderController,
                      label: 'Account holder name',
                      icon: Icons.person_outline_rounded,
                      textCapitalization: TextCapitalization.words,
                    ),
                    const SizedBox(height: 12),
                    _BankField(
                      controller: accountController,
                      label: 'Bank account number',
                      icon: Icons.account_balance_rounded,
                      keyboardType: TextInputType.number,
                    ),
                    const SizedBox(height: 12),
                    _BankField(
                      controller: ifscController,
                      label: 'IFSC code',
                      icon: Icons.tag_rounded,
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: 12),
                    _BankField(
                      controller: bankController,
                      label: 'Bank name (optional)',
                      icon: Icons.business_rounded,
                      textCapitalization: TextCapitalization.words,
                    ),
                    if (localError.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        localError,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving
                      ? null
                      : () {
                          Navigator.of(dialogContext).pop();
                        },
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final holder = holderController.text.trim();
                          final account = accountController.text.trim();
                          final ifsc = ifscController.text.trim().toUpperCase();
                          final bank = bankController.text.trim();

                          if (holder.length < 2) {
                            setDialogState(() {
                              localError =
                                  'Enter the bank account holder name.';
                            });
                            return;
                          }

                          if (!RegExp(r'^[0-9]{6,20}$').hasMatch(account)) {
                            setDialogState(() {
                              localError = 'Enter a valid bank account number.';
                            });
                            return;
                          }

                          if (!RegExp(
                            r'^[A-Za-z]{4}0[A-Za-z0-9]{6}$',
                          ).hasMatch(ifsc)) {
                            setDialogState(() {
                              localError = 'Enter a valid IFSC code.';
                            });
                            return;
                          }

                          setDialogState(() {
                            saving = true;
                            localError = '';
                          });

                          try {
                            final token = await _accessToken();

                            if (token.isEmpty) {
                              throw const AstrologerPortalApiException(
                                'Login session not found. Please login again.',
                              );
                            }

                            await _api.savePayoutBankAccount(
                              accessToken: token,
                              accountHolderName: holder,
                              accountNumber: account,
                              ifsc: ifsc,
                              bankName: bank.isEmpty ? null : bank,
                            );

                            if (!dialogContext.mounted) {
                              return;
                            }

                            Navigator.of(dialogContext).pop();

                            if (mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Payout bank account saved successfully.',
                                  ),
                                ),
                              );

                              await _load();
                            }
                          } on AstrologerPortalApiException catch (error) {
                            if (dialogContext.mounted) {
                              setDialogState(() {
                                saving = false;
                                localError = error.message;
                              });
                            }
                          } catch (_) {
                            if (dialogContext.mounted) {
                              setDialogState(() {
                                saving = false;
                                localError =
                                    'Unable to save payout bank account.';
                              });
                            }
                          }
                        },
                  child: saving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Save account'),
                ),
              ],
            );
          },
        );
      },
    );

    holderController.dispose();
    accountController.dispose();
    ifscController.dispose();
    bankController.dispose();
  }

  Future<void> _requestWithdrawal() async {
    if (_payoutSubmitting) {
      return;
    }

    final available = _amount('availableBalance');

    if (available <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('There is no available balance to withdraw.'),
        ),
      );
      return;
    }

    if (_bankAccount == null) {
      await _showBankAccountDialog();
      return;
    }

    final masked =
        _bankAccount?['maskedAccountNumber']?.toString() ?? 'bank account';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.surface,
          title: const Text(
            'Confirm withdrawal',
            style: TextStyle(
              color: AppColors.white,
              fontWeight: FontWeight.w800,
            ),
          ),
          content: Text(
            'Withdraw ₹${available.toStringAsFixed(2)} '
            'to $masked?\n\n'
            'The full currently available balance will be submitted '
            'for payout.',
            style: const TextStyle(color: AppColors.white, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Withdraw'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _payoutSubmitting = true;
    });

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
        );
      }

      final response = await _api.requestPayout(
        accessToken: token,
        mode: 'IMPS',
      );

      final data = response['data'];

      final status = data is Map
          ? data['status']?.toString() ?? 'PROCESSING'
          : 'PROCESSING';

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Withdrawal submitted. Status: $status')),
      );

      await _load();
    } on AstrologerPortalApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to submit withdrawal.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _payoutSubmitting = false;
        });
      }
    }
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
      case 'PAID':
        return Colors.greenAccent;

      case 'FAILED':
      case 'REVERSED':
      case 'CANCELLED':
        return Colors.redAccent;

      case 'REQUESTED':
      case 'PROCESSING':
      case 'PENDING':
        return Colors.orangeAccent;

      case 'AVAILABLE':
        return AppColors.gold;

      default:
        return AppColors.muted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Earnings'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _error,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.white),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(onPressed: _load, child: const Text('Retry')),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _EarningCard(
                    title: 'Available Balance',
                    value: _money('availableBalance'),
                    featured: true,
                  ),

                  _PayoutActionCard(
                    bankAccount: _bankAccount,
                    availableBalance: _amount('availableBalance'),
                    submitting: _payoutSubmitting,
                    onBankAccount: _showBankAccountDialog,
                    onWithdraw: _requestWithdrawal,
                  ),

                  const SizedBox(height: 8),

                  _EarningCard(title: 'Today', value: _money('todayEarnings')),
                  _EarningCard(
                    title: 'This Week',
                    value: _money('weekEarnings'),
                  ),
                  _EarningCard(
                    title: 'This Month',
                    value: _money('monthEarnings'),
                  ),
                  _EarningCard(
                    title: 'Lifetime Earnings',
                    value: _money('lifetimeEarnings'),
                  ),
                  _EarningCard(
                    title: 'Pending Payout',
                    value: _money('pendingBalance'),
                  ),
                  _EarningCard(title: 'Paid', value: _money('paidAmount')),

                  const SizedBox(height: 24),

                  const _SectionTitle(title: 'Payout history'),
                  const SizedBox(height: 12),

                  if (_payouts.isEmpty)
                    const _EmptyCard(text: 'No payout history yet.')
                  else
                    ..._payouts.map(
                      (payout) => _PayoutHistoryCard(
                        payout: payout,
                        money: _valueMoney,
                        statusColor: _statusColor,
                      ),
                    ),

                  const SizedBox(height: 24),

                  const _SectionTitle(title: 'Earning transactions'),
                  const SizedBox(height: 12),

                  if (_transactions.isEmpty)
                    const _EmptyCard(text: 'No earnings transactions yet.')
                  else
                    ..._transactions.map((item) {
                      final status =
                          item['status']?.toString().trim().toUpperCase() ??
                          'UNKNOWN';

                      final gross =
                          double.tryParse(
                            item['grossAmount']?.toString() ?? '',
                          ) ??
                          0;

                      final platformFee =
                          double.tryParse(
                            item['platformFee']?.toString() ?? '',
                          ) ??
                          0;

                      final net =
                          double.tryParse(
                            item['netAmount']?.toString() ?? '',
                          ) ??
                          0;

                      final statusColor = _statusColor(status);

                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: AppColors.gold.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Column(
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 42,
                                  height: 42,
                                  decoration: BoxDecoration(
                                    color: AppColors.gold.withValues(
                                      alpha: 0.10,
                                    ),
                                    borderRadius: BorderRadius.circular(13),
                                  ),
                                  child: const Icon(
                                    Icons.payments_outlined,
                                    color: AppColors.gold,
                                    size: 21,
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'Consultation earning',
                                        style: TextStyle(
                                          color: AppColors.white,
                                          fontSize: 14,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                      const SizedBox(height: 5),
                                      _StatusBadge(
                                        status: status,
                                        color: statusColor,
                                      ),
                                    ],
                                  ),
                                ),
                                Text(
                                  '₹${net.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: AppColors.gold,
                                    fontSize: 17,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 14),
                            Row(
                              children: [
                                Expanded(
                                  child: _TransactionMetric(
                                    label: 'Gross',
                                    value: '₹${gross.toStringAsFixed(2)}',
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _TransactionMetric(
                                    label: 'Platform fee',
                                    value: '₹${platformFee.toStringAsFixed(2)}',
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _TransactionMetric(
                                    label: 'Your earning',
                                    value: '₹${net.toStringAsFixed(2)}',
                                    highlight: true,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }),

                  const SizedBox(height: 20),
                ],
              ),
            ),
    );
  }
}

class _PayoutActionCard extends StatelessWidget {
  const _PayoutActionCard({
    required this.bankAccount,
    required this.availableBalance,
    required this.submitting,
    required this.onBankAccount,
    required this.onWithdraw,
  });

  final Map<String, dynamic>? bankAccount;
  final double availableBalance;
  final bool submitting;
  final VoidCallback onBankAccount;
  final VoidCallback onWithdraw;

  @override
  Widget build(BuildContext context) {
    final hasBank = bankAccount != null;

    final masked = bankAccount?['maskedAccountNumber']?.toString() ?? '';

    final bankName = bankAccount?['bankName']?.toString().trim() ?? '';

    final verified = bankAccount?['isVerified'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_rounded, color: AppColors.gold),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Payout account',
                  style: TextStyle(
                    color: AppColors.white,
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ),
              if (verified)
                const Icon(
                  Icons.verified_rounded,
                  color: Colors.greenAccent,
                  size: 20,
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (hasBank) ...[
            Text(
              bankName.isEmpty ? masked : '$bankName  •  $masked',
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 5),
            Text(
              bankAccount?['ifsc']?.toString() ?? '',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          ] else
            const Text(
              'Add the bank account where you want to receive your earnings.',
              style: TextStyle(color: AppColors.muted, height: 1.4),
            ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: submitting ? null : onBankAccount,
                  icon: Icon(hasBank ? Icons.edit_outlined : Icons.add_rounded),
                  label: Text(hasBank ? 'Change bank' : 'Add bank'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: submitting || !hasBank || availableBalance <= 0
                      ? null
                      : onWithdraw,
                  icon: submitting
                      ? const SizedBox(
                          width: 17,
                          height: 17,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.account_balance_wallet_outlined),
                  label: Text(submitting ? 'Submitting' : 'Withdraw'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayoutHistoryCard extends StatelessWidget {
  const _PayoutHistoryCard({
    required this.payout,
    required this.money,
    required this.statusColor,
  });

  final Map<String, dynamic> payout;
  final String Function(dynamic) money;
  final Color Function(String) statusColor;

  @override
  Widget build(BuildContext context) {
    final status = payout['status']?.toString().toUpperCase() ?? 'UNKNOWN';

    final bank = payout['bankAccount'];

    String masked = '';

    if (bank is Map) {
      masked = bank['maskedAccountNumber']?.toString() ?? '';
    }

    final failureReason = payout['failureReason']?.toString().trim() ?? '';

    final color = statusColor(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color.withValues(alpha: 0.15)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  money(payout['amount']),
                  style: const TextStyle(
                    color: AppColors.gold,
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              _StatusBadge(status: status, color: color),
            ],
          ),
          const SizedBox(height: 8),
          if (masked.isNotEmpty)
            Text(
              'Bank account $masked',
              style: const TextStyle(color: AppColors.muted, fontSize: 12),
            ),
          if (failureReason.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              failureReason,
              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status, required this.color});

  final String status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _BankField extends StatelessWidget {
  const _BankField({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
  });

  final TextEditingController controller;
  final String label;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      style: const TextStyle(color: AppColors.white),
      decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon)),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: AppColors.white,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Center(
        child: Text(text, style: const TextStyle(color: AppColors.muted)),
      ),
    );
  }
}

class _TransactionMetric extends StatelessWidget {
  const _TransactionMetric({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final String value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 9),
      decoration: BoxDecoration(
        color: AppColors.background.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.muted, fontSize: 9),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: highlight ? AppColors.gold : AppColors.white,
              fontSize: 12,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _EarningCard extends StatelessWidget {
  const _EarningCard({
    required this.title,
    required this.value,
    this.featured = false,
  });

  final String title;
  final String value;
  final bool featured;

  IconData get _icon {
    switch (title) {
      case 'Available Balance':
        return Icons.account_balance_wallet_rounded;
      case 'Today':
        return Icons.today_rounded;
      case 'This Week':
        return Icons.date_range_rounded;
      case 'This Month':
        return Icons.calendar_month_rounded;
      case 'Lifetime Earnings':
        return Icons.auto_graph_rounded;
      case 'Pending Payout':
        return Icons.hourglass_top_rounded;
      case 'Paid':
        return Icons.verified_rounded;
      default:
        return Icons.currency_rupee_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (featured) {
      return Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            Container(
              width: 54,
              height: 54,
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Icon(_icon, color: AppColors.gold, size: 27),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 27,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  const Text(
                    'Ready for payout',
                    style: TextStyle(color: AppColors.muted, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(17),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.10)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(_icon, color: AppColors.gold, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              title,
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 13,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Text(
            value,
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}
