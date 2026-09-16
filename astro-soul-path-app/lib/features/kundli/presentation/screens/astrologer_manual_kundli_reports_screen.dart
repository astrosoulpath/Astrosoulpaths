import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_manual_kundli_report.dart';
import '../../data/astrologer_manual_kundli_report_api.dart';
import 'astrologer_manual_kundli_report_editor_screen.dart';

class AstrologerManualKundliReportsScreen extends StatefulWidget {
  const AstrologerManualKundliReportsScreen({super.key});

  @override
  State<AstrologerManualKundliReportsScreen> createState() =>
      _AstrologerManualKundliReportsScreenState();
}

class _AstrologerManualKundliReportsScreenState
    extends State<AstrologerManualKundliReportsScreen> {
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
      final reports = await _api.getAstrologerReports();

      if (!mounted) {
        return;
      }

      final sorted = [...reports]
        ..sort((a, b) {
          final aDate =
              a.updatedAt ??
              a.createdAt ??
              DateTime.fromMillisecondsSinceEpoch(0);

          final bDate =
              b.updatedAt ??
              b.createdAt ??
              DateTime.fromMillisecondsSinceEpoch(0);

          return bDate.compareTo(aDate);
        });

      setState(() {
        _reports = sorted;
        _loading = false;
        _error = '';
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
        _error = 'Unable to load professional Kundli reports.';
      });
    }
  }

  Future<void> _openReport(AstrologerManualKundliReport report) async {
    final sessionId = report.callSessionId.trim();

    if (sessionId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'This report does not have a valid consultation session.',
          ),
        ),
      );

      return;
    }

    final displayName = _reportHeading(report);

    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AstrologerManualKundliReportEditorScreen(
          callSessionId: sessionId,
          customerName: displayName,
        ),
      ),
    );

    if (mounted) {
      await _load();
    }
  }

  String _reportHeading(AstrologerManualKundliReport report) {
    final title = report.title?.trim() ?? '';

    if (title.isNotEmpty) {
      return title;
    }

    final customerId = report.customerUserId.trim();

    if (customerId.isNotEmpty) {
      final visible = customerId.length > 8
          ? customerId.substring(customerId.length - 8)
          : customerId;

      return 'Consultation • $visible';
    }

    return 'Professional Kundli Report';
  }

  String _shortSessionId(String value) {
    final id = value.trim();

    if (id.length <= 10) {
      return id;
    }

    return '${id.substring(0, 5)}...${id.substring(id.length - 5)}';
  }

  String _updatedLabel(AstrologerManualKundliReport report) {
    final date = report.updatedAt ?? report.createdAt;

    if (date == null) {
      return 'Date unavailable';
    }

    final local = date.toLocal();

    String two(int value) => value.toString().padLeft(2, '0');

    return '${two(local.day)}/${two(local.month)}/${local.year} '
        '${two(local.hour)}:${two(local.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Professional Kundli Reports'),
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

  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              size: 46,
              color: Colors.redAccent,
            ),
            const SizedBox(height: 12),
            Text(_error, textAlign: TextAlign.center),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 80),
        Container(
          width: 72,
          height: 72,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(22),
          ),
          child: const Icon(
            Icons.description_outlined,
            color: AppColors.gold,
            size: 34,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'No professional reports yet',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900),
        ),
        const SizedBox(height: 10),
        const Text(
          'Open Customer History and choose Report on a consultation '
          'to prepare a professional Kundli report.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.muted, height: 1.5),
        ),
      ],
    );
  }

  Widget _reportCard(AstrologerManualKundliReport report) {
    final isFinal = report.isFinal;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.14)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: () => _openReport(report),
        child: Padding(
          padding: const EdgeInsets.all(15),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  color: isFinal
                      ? Colors.greenAccent.withValues(alpha: 0.08)
                      : AppColors.gold.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  isFinal ? Icons.verified_rounded : Icons.edit_note_rounded,
                  color: isFinal ? Colors.greenAccent : AppColors.gold,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _reportHeading(report),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 7),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: isFinal
                                ? Colors.greenAccent.withValues(alpha: 0.08)
                                : AppColors.gold.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(999),
                          ),
                          child: Text(
                            isFinal ? 'FINAL' : 'DRAFT',
                            style: TextStyle(
                              color: isFinal
                                  ? Colors.greenAccent
                                  : AppColors.gold,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                        Text(
                          'Session ${_shortSessionId(report.callSessionId)}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Updated ${_updatedLabel(report)}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right_rounded, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
