import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../subscription/data/subscription_api.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import 'astrologer_generate_kundli_screen.dart';
import 'astrologer_saved_kundlis_screen.dart';

class AstrologerKundliScreen extends StatefulWidget {
  const AstrologerKundliScreen({super.key});

  @override
  State<AstrologerKundliScreen> createState() => _AstrologerKundliScreenState();
}

class _AstrologerKundliScreenState extends State<AstrologerKundliScreen> {
  final SubscriptionApi _subscriptionApi = SubscriptionApi();

  bool _loadingSubscription = true;
  bool _hasProfessionalAccess = false;

  String _subscriptionStatus = '';
  String _subscriptionError = '';

  DateTime? _subscriptionEndDate;

  @override
  void initState() {
    super.initState();
    _loadProfessionalAccess();
  }

  @override
  void dispose() {
    _subscriptionApi.close();
    super.dispose();
  }

  Future<void> _loadProfessionalAccess() async {
    if (mounted) {
      setState(() {
        _loadingSubscription = true;
        _subscriptionError = '';
      });
    }

    try {
      final subscription = await _subscriptionApi.getCurrentSubscription();

      if (!mounted) {
        return;
      }

      if (subscription == null) {
        setState(() {
          _hasProfessionalAccess = false;
          _subscriptionStatus = '';
          _subscriptionEndDate = null;
          _loadingSubscription = false;
        });

        return;
      }

      final rawPlan = subscription['subscriptionPlan'];

      final plan = rawPlan is Map
          ? Map<String, dynamic>.from(rawPlan)
          : <String, dynamic>{};

      final status =
          subscription['subscriptionStatus']?.toString().toUpperCase() ?? '';

      final planName = plan['name']?.toString() ?? '';

      final planActive = plan['isActive'] != false;

      final rawStartDate = subscription['startDate']?.toString();
      final rawEndDate = subscription['endDate']?.toString();

      final startDate = rawStartDate == null
          ? null
          : DateTime.tryParse(rawStartDate);

      final endDate = rawEndDate == null ? null : DateTime.tryParse(rawEndDate);

      final now = DateTime.now();

      final statusAllowsAccess = status == 'ACTIVE' || status == 'TRIAL';

      final correctPlan = planName == 'ASTROLOGER_KUNDLI_YEARLY';

      final started = startDate == null || !startDate.isAfter(now);

      final notExpired = endDate == null || endDate.isAfter(now);

      final hasAccess =
          statusAllowsAccess &&
          correctPlan &&
          planActive &&
          started &&
          notExpired;

      setState(() {
        _hasProfessionalAccess = hasAccess;
        _subscriptionStatus = status;
        _subscriptionEndDate = endDate;
        _loadingSubscription = false;
      });
    } on SubscriptionApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _hasProfessionalAccess = false;
        _subscriptionError = error.message;
        _loadingSubscription = false;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _hasProfessionalAccess = false;
        _subscriptionError = 'Unable to verify Professional Kundli access.';
        _loadingSubscription = false;
      });
    }
  }

  String _formatDate(DateTime value) {
    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');

    return '$day/$month/${value.year}';
  }

  Future<void> _openProfessionalPlan() async {
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const SubscriptionPlansScreen(
          audience: SubscriptionAudience.astrologer,
        ),
      ),
    );

    if (mounted) {
      await _loadProfessionalAccess();
    }
  }

  Future<bool> _ensureProfessionalAccess() async {
    if (_loadingSubscription) {
      return false;
    }

    if (_hasProfessionalAccess) {
      return true;
    }

    final openPlan = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Kundli Professional Plan Required'),
          content: Text(
            _subscriptionStatus == 'EXPIRED'
                ? 'Your Professional Kundli subscription has expired. Renew the yearly plan to continue.'
                : 'An active Professional Kundli yearly subscription is required to use astrologer Kundli tools.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Not Now'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: Text(
                _subscriptionStatus == 'EXPIRED' ? 'Renew Plan' : 'View Plan',
              ),
            ),
          ],
        );
      },
    );

    if (openPlan == true && mounted) {
      await _openProfessionalPlan();
    }

    return false;
  }

  Future<void> _openGenerateKundli() async {
    if (!await _ensureProfessionalAccess()) {
      return;
    }

    if (!mounted) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const AstrologerGenerateKundliScreen(),
      ),
    );
  }

  Future<void> _openSavedKundlis() async {
    if (!await _ensureProfessionalAccess()) {
      return;
    }

    if (!mounted) {
      return;
    }

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const AstrologerSavedKundlisScreen(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final endDate = _subscriptionEndDate;

    String planSubtitle;

    if (_loadingSubscription) {
      planSubtitle = 'Checking Professional Kundli subscription...';
    } else if (_hasProfessionalAccess) {
      planSubtitle = endDate == null
          ? 'ACTIVE - Professional Kundli access enabled.'
          : 'ACTIVE until ${_formatDate(endDate)}';
    } else if (_subscriptionStatus == 'EXPIRED') {
      planSubtitle = 'Expired - renew your yearly Professional Kundli plan.';
    } else {
      planSubtitle = 'Subscribe to unlock professional Kundli tools.';
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Professional Kundli',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900),
            ),
            Text(
              'Astrologer Tools',
              style: TextStyle(
                color: AppColors.gold,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh subscription',
            onPressed: _loadingSubscription ? null : _loadProfessionalAccess,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadProfessionalAccess,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.28),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(
                          Icons.auto_awesome_rounded,
                          color: AppColors.gold,
                          size: 26,
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Professional Kundli Generation',
                            style: TextStyle(
                              color: AppColors.white,
                              fontSize: 17,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Generate professional Vedic Kundlis for your clients using the Astro Soul Path astrologer plan.',
                      style: TextStyle(
                        color: AppColors.muted,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 14),
                    _SubscriptionStatusBadge(
                      loading: _loadingSubscription,
                      active: _hasProfessionalAccess,
                      status: _subscriptionStatus,
                    ),
                    if (_subscriptionError.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        _subscriptionError,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),

              _ProfessionalToolCard(
                icon: _hasProfessionalAccess
                    ? Icons.add_chart_rounded
                    : Icons.lock_outline_rounded,
                title: 'Generate Kundli',
                subtitle: _hasProfessionalAccess
                    ? 'Create a new client Kundli using birth date, birth time and verified place.'
                    : 'Professional plan required to generate client Kundlis.',
                onTap: _openGenerateKundli,
              ),

              _ProfessionalToolCard(
                icon: _hasProfessionalAccess
                    ? Icons.folder_copy_outlined
                    : Icons.lock_outline_rounded,
                title: 'Saved Kundlis',
                subtitle: _hasProfessionalAccess
                    ? 'View Kundlis previously generated for your clients.'
                    : 'Professional plan required to access saved Kundlis.',
                onTap: _openSavedKundlis,
              ),

              _ProfessionalToolCard(
                icon: _hasProfessionalAccess
                    ? Icons.picture_as_pdf_outlined
                    : Icons.lock_outline_rounded,
                title: 'Professional Reports',
                subtitle: _hasProfessionalAccess
                    ? 'Access and download professional Kundli PDF reports.'
                    : 'Professional plan required to access reports.',
                onTap: _openSavedKundlis,
              ),

              _ProfessionalToolCard(
                icon: _hasProfessionalAccess
                    ? Icons.verified_rounded
                    : Icons.workspace_premium_outlined,
                title: 'Kundli Professional Plan',
                subtitle: planSubtitle,
                onTap: _openProfessionalPlan,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SubscriptionStatusBadge extends StatelessWidget {
  const _SubscriptionStatusBadge({
    required this.loading,
    required this.active,
    required this.status,
  });

  final bool loading;
  final bool active;
  final String status;

  @override
  Widget build(BuildContext context) {
    final label = loading
        ? 'CHECKING ACCESS'
        : active
        ? 'PLAN ACTIVE'
        : status.isEmpty
        ? 'PLAN REQUIRED'
        : status;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: active ? 0.16 : 0.08),
        borderRadius: BorderRadius.circular(30),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (loading)
            const SizedBox(
              width: 13,
              height: 13,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(
              active ? Icons.verified_rounded : Icons.lock_outline_rounded,
              color: AppColors.gold,
              size: 16,
            ),
          const SizedBox(width: 7),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.gold,
              fontSize: 11,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

class _ProfessionalToolCard extends StatelessWidget {
  const _ProfessionalToolCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 15),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.20)),
            ),
            child: Row(
              children: [
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.11),
                    borderRadius: BorderRadius.circular(15),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.24),
                    ),
                  ),
                  child: Icon(icon, color: AppColors.gold, size: 23),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: AppColors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 5),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.09),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward_ios_rounded,
                    color: AppColors.gold,
                    size: 14,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
