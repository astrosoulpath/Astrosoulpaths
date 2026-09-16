import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../subscription/presentation/screens/subscription_plans_screen.dart';
import '../../data/kundli_api.dart';
import 'astrologer_saved_kundli_detail_screen.dart';

class AstrologerSavedKundlisScreen extends StatefulWidget {
  const AstrologerSavedKundlisScreen({super.key});

  @override
  State<AstrologerSavedKundlisScreen> createState() =>
      _AstrologerSavedKundlisScreenState();
}

class _AstrologerSavedKundlisScreenState
    extends State<AstrologerSavedKundlisScreen> {
  final KundliApi _api = KundliApi();

  bool _loading = true;
  String _error = '';

  List<ProfessionalSavedKundli> _records = const [];

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

  Future<void> _load() async {
    if (!mounted) {
      return;
    }

    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final records = await _api.getProfessionalSavedKundlis();

      if (!mounted) {
        return;
      }

      setState(() {
        _records = records;
      });
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      if (error.subscriptionRequired) {
        final openPlan = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('Professional Kundli Plan Required'),
            content: Text(error.message),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogContext).pop(false),
                child: const Text('Not Now'),
              ),
              FilledButton(
                onPressed: () => Navigator.of(dialogContext).pop(true),
                child: const Text('View Plan'),
              ),
            ],
          ),
        );

        if (openPlan == true && mounted) {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const SubscriptionPlansScreen(
                audience: SubscriptionAudience.astrologer,
              ),
            ),
          );
        }
      }

      if (mounted) {
        setState(() {
          _error = error.message;
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

  String _date(DateTime? value) {
    if (value == null) {
      return '--';
    }

    final day = value.day.toString().padLeft(2, '0');
    final month = value.month.toString().padLeft(2, '0');

    return '$day/$month/${value.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Saved Kundlis',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(onRefresh: _load, child: _body()),
      ),
    );
  }

  Widget _body() {
    if (_loading) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          SizedBox(height: 180),
          Center(child: CircularProgressIndicator()),
        ],
      );
    }

    if (_error.isNotEmpty && _records.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 100),
          const Icon(
            Icons.error_outline_rounded,
            size: 48,
            color: AppColors.gold,
          ),
          const SizedBox(height: 15),
          Text(
            _error,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted, height: 1.4),
          ),
          const SizedBox(height: 16),
          FilledButton(onPressed: _load, child: const Text('Try Again')),
        ],
      );
    }

    if (_records.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: const [
          SizedBox(height: 100),
          Icon(Icons.folder_open_outlined, size: 54, color: AppColors.gold),
          SizedBox(height: 16),
          Text(
            'No saved Kundlis yet',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: AppColors.white,
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          SizedBox(height: 8),
          Text(
            'Client Kundlis generated from the Professional Kundli tool will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted, height: 1.4),
          ),
        ],
      );
    }

    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      itemCount: _records.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (context, index) {
        final record = _records[index];

        return Material(
          color: Colors.transparent,
          child: InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () async {
              await Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => AstrologerSavedKundliDetailScreen(
                    savedRecordId: record.id,
                    initialRecord: record,
                  ),
                ),
              );
            },
            child: Ink(
              padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.20),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.10),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.auto_awesome_outlined,
                      color: AppColors.gold,
                    ),
                  ),
                  const SizedBox(width: 13),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          record.name.isEmpty ? 'Unnamed client' : record.name,
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 5),
                        Text(
                          [
                            if (record.birthPlace.isNotEmpty) record.birthPlace,
                            if (record.dob.isNotEmpty) 'DOB ${record.dob}',
                          ].join(' | '),
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Generated ${_date(record.createdAt)}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const Icon(
                    Icons.chevron_right_rounded,
                    color: AppColors.gold,
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
