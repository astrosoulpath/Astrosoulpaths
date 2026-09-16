import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_manual_kundli_report.dart';
import '../../data/astrologer_manual_kundli_report_api.dart';
import 'customer_astrologer_kundli_report_detail_screen.dart';

class CustomerAstrologerKundliReportsScreen extends StatefulWidget {
  const CustomerAstrologerKundliReportsScreen({super.key});

  @override
  State<CustomerAstrologerKundliReportsScreen> createState() =>
      _CustomerAstrologerKundliReportsScreenState();
}

class _CustomerAstrologerKundliReportsScreenState
    extends State<CustomerAstrologerKundliReportsScreen> {
  final _api = AstrologerManualKundliReportApi();

  bool _loading = true;
  String _error = '';

  List<AstrologerManualKundliReport> _reports = const [];

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
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final response = await _api.getCustomerFinalReports();

      // Defense in depth:
      // backend already returns FINAL-only, but customer UI also filters.
      final finalOnly = response
          .where((report) => report.isFinal)
          .toList(growable: false);

      final sorted = [...finalOnly]
        ..sort((a, b) {
          final aDate =
              a.finalizedAt ??
              a.updatedAt ??
              DateTime.fromMillisecondsSinceEpoch(0);

          final bDate =
              b.finalizedAt ??
              b.updatedAt ??
              DateTime.fromMillisecondsSinceEpoch(0);

          return bDate.compareTo(aDate);
        });

      if (!mounted) {
        return;
      }

      setState(() {
        _reports = sorted;
        _loading = false;
      });
    } on AstrologerManualKundliReportApiException catch (error) {
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
        _error = 'Unable to load astrologer reports.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Astrologer Reports')),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty && _reports.isEmpty
          ? _errorState()
          : RefreshIndicator(
              onRefresh: _load,
              child: _reports.isEmpty
                  ? _emptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                      itemCount: _reports.length,
                      itemBuilder: (context, index) {
                        return _reportCard(_reports[index]);
                      },
                    ),
            ),
    );
  }

  Widget _reportCard(AstrologerManualKundliReport report) {
    final title = report.title?.trim() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.14)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) =>
                  CustomerAstrologerKundliReportDetailScreen(report: report),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: Colors.greenAccent.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(15),
                ),
                child: const Icon(
                  Icons.description_outlined,
                  color: AppColors.gold,
                ),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.isNotEmpty ? title : 'Professional Kundli Report',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.greenAccent.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: const Text(
                            'FINAL',
                            style: TextStyle(
                              color: Colors.greenAccent,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text(
                            'Prepared by astrologer',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: AppColors.muted,
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }

  Widget _emptyState() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 100),
        const Icon(Icons.description_outlined, size: 52, color: AppColors.gold),
        const SizedBox(height: 18),
        const Text(
          'No astrologer reports yet',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 19, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 9),
        const Text(
          'A finalized professional Kundli report prepared by your '
          'astrologer will appear here.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, height: 1.5),
        ),
      ],
    );
  }

  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
