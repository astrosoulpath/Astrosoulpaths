import 'dart:convert';

import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/kundli_api.dart';
import 'kundli_pdf_preview_screen.dart';
import 'astrologer_manual_kundli_reports_screen.dart';

class AstrologerSavedKundliDetailScreen extends StatefulWidget {
  const AstrologerSavedKundliDetailScreen({
    super.key,
    required this.savedRecordId,
    this.initialRecord,
    this.api,
  });

  final KundliApi? api;
  final String savedRecordId;
  final ProfessionalSavedKundli? initialRecord;

  @override
  State<AstrologerSavedKundliDetailScreen> createState() =>
      _AstrologerSavedKundliDetailScreenState();
}

class _AstrologerSavedKundliDetailScreenState
    extends State<AstrologerSavedKundliDetailScreen> {
  late final KundliApi _api = widget.api ?? KundliApi();

  ProfessionalSavedKundliDetail? _detail;

  bool _loading = true;
  bool _loadingPdf = false;

  String _error = '';

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
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final detail = await _api.getProfessionalSavedKundli(
        savedRecordId: widget.savedRecordId,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _detail = detail;
      });
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  bool get _professionalPdfReady {
    final report = _detail?.report;

    return report != null &&
        report.isComplete &&
        report.coreCompletenessPercent >= 100;
  }

  Future<void> _openPdf() async {
    if (_loadingPdf) {
      return;
    }
    if (!_professionalPdfReady) {
      if (!mounted) {
        return;
      }

      final report = _detail?.report;
      final percent = report?.coreCompletenessPercent ?? 0;

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              'Professional PDF is not ready yet. '
              'Kundli calculation is $percent% complete. '
              'Provider regeneration is retired. Create a consultation report from Customer History.',
            ),
          ),
        );

      return;
    }

    setState(() {
      _loadingPdf = true;
    });

    try {
      final bytes = await _api.downloadSavedKundliPdf(
        savedRecordId: widget.savedRecordId,
      );

      if (!mounted) {
        return;
      }

      final safeName = (_detail?.record.name ?? 'client')
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '-')
          .replaceAll(RegExp(r'-+'), '-');

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => KundliPdfPreviewScreen(
            bytes: bytes,
            fileName:
                'professional-kundli-${safeName.isEmpty ? 'client' : safeName}.pdf',
          ),
        ),
      );
    } on KundliApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _loadingPdf = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final record = _detail?.record ?? widget.initialRecord;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: Text(
          record?.name.isNotEmpty == true ? record!.name : 'Saved Kundli',
          style: const TextStyle(fontWeight: FontWeight.w900),
        ),
        actions: [
          IconButton(
            tooltip: 'PDF',
            onPressed: _loading || _loadingPdf || !_professionalPdfReady
                ? null
                : _openPdf,
            icon: _loadingPdf
                ? const SizedBox(
                    width: 19,
                    height: 19,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
          ),
        ],
      ),
      body: SafeArea(child: _body()),
    );
  }

  Widget _body() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error.isNotEmpty || _detail == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: AppColors.gold, size: 48),
              const SizedBox(height: 14),
              Text(
                _error.isEmpty ? 'Unable to load saved Kundli.' : _error,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 14),
              FilledButton(onPressed: _load, child: const Text('Try Again')),
            ],
          ),
        ),
      );
    }

    final detail = _detail!;
    final record = detail.record;
    final report = detail.report;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _InfoCard(
          title: 'Client Birth Details',
          children: [
            _Row(label: 'Name', value: record.name),
            _Row(label: 'Gender', value: record.gender),
            _Row(label: 'Birth Place', value: record.birthPlace),
            _Row(label: 'DOB', value: record.dob),
            _Row(label: 'Time', value: record.tob),
            _Row(label: 'Latitude', value: record.latitude.toString()),
            _Row(label: 'Longitude', value: record.longitude.toString()),
            _Row(label: 'Timezone', value: record.timezone.toString()),
            _Row(label: 'Language', value: record.language.toUpperCase()),
          ],
        ),

        const SizedBox(height: 14),

        _InfoCard(
          title: 'Report Status',
          children: [
            _Row(
              label: 'Provider',
              value: report.provider.isEmpty
                  ? 'Vedic Backend'
                  : report.provider,
            ),
            _Row(label: 'Status', value: report.status),
            _Row(label: 'Core', value: '${report.coreCompletenessPercent}%'),
          ],
        ),

        _ReportSection(title: 'Birth Chart (D1)', value: report.birthChart),

        _ReportSection(title: 'Navamsa (D9)', value: report.navamsaChart),
        const SizedBox(height: 10),

        _InfoCard(
          title: 'Advanced Vargas',
          children: [
            _Row(label: 'Available', value: report.advancedVargaCoverageLabel),
            _Row(
              label: 'Status',
              value: report.hasAllAdvancedVargas
                  ? 'Complete'
                  : report.hasAnyAdvancedVarga
                  ? 'Partially available'
                  : 'Not available',
            ),
            if (report.missingAdvancedVargas.isNotEmpty)
              _Row(
                label: 'Unavailable',
                value: report.missingAdvancedVargas.join(', '),
              ),
          ],
        ),

        _ReportSection(title: 'D2 Hora', value: report.horaChart),

        _ReportSection(title: 'D3 Drekkana', value: report.drekkanaChart),

        _ReportSection(title: 'D7 Saptamsa', value: report.saptamsaChart),

        _ReportSection(title: 'D10 Dasamsa', value: report.dasamsaChart),

        _ReportSection(title: 'D12 Dwadasamsa', value: report.dwadasamsaChart),

        _ReportSection(
          title: 'D60 Shashtiamsa',
          value: report.shashtiamsaChart,
        ),

        _ReportSection(
          title: 'Planetary Positions',
          value: report.raw['planetaryPositions'],
        ),

        _ReportSection(title: 'Dasha', value: report.raw['dasha']),

        _ReportSection(title: 'Panchang', value: report.raw['panchang']),

        _ReportSection(title: 'Yogas', value: report.raw['yogas']),

        _ReportSection(
          title: 'Dosha',
          value: report.raw['dosha'] ?? report.raw['doshas'],
        ),

        _ReportSection(title: 'Shadbala', value: report.raw['shadbala']),

        _ReportSection(
          title: 'Ashtakavarga',
          value: report.raw['ashtakavarga'],
        ),

        const SizedBox(height: 8),

        if (!_professionalPdfReady) ...[
          const Text(
            'Provider regeneration is retired. Existing saved charts remain available. '
            'To prepare a new professional report, open Customer History and select '
            'Report for an authorized consultation.',
          ),
          TextButton.icon(
            onPressed: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => const AstrologerManualKundliReportsScreen(),
              ),
            ),
            icon: const Icon(Icons.description_outlined),
            label: const Text('View Consultation Reports'),
          ),
          const SizedBox(height: 10),
        ],
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            onPressed: _loadingPdf || !_professionalPdfReady ? null : _openPdf,
            icon: _loadingPdf
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.picture_as_pdf_outlined),
            label: Text(
              _professionalPdfReady
                  ? 'Open Professional PDF'
                  : 'Professional PDF Not Ready',
            ),
          ),
        ),

        const SizedBox(height: 30),
      ],
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: AppColors.white,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 14),
          ...children,
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 105,
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '--' : value,
              style: const TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReportSection extends StatelessWidget {
  const _ReportSection({required this.title, required this.value});

  final String title;
  final Object? value;

  @override
  Widget build(BuildContext context) {
    if (value == null) {
      return const SizedBox.shrink();
    }

    String text;

    try {
      const encoder = JsonEncoder.withIndent('  ');
      text = encoder.convert(value);
    } catch (_) {
      text = value.toString();
    }

    if (text.trim().isEmpty || text.trim() == '{}' || text.trim() == '[]') {
      return const SizedBox.shrink();
    }

    return Padding(
      padding: const EdgeInsets.only(top: 14),
      child: ExpansionTile(
        collapsedBackgroundColor: AppColors.surface,
        backgroundColor: AppColors.surface,
        iconColor: AppColors.gold,
        collapsedIconColor: AppColors.gold,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        collapsedShape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
        ),
        title: Text(
          title,
          style: const TextStyle(
            color: AppColors.white,
            fontWeight: FontWeight.w800,
          ),
        ),
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: SelectableText(
              text,
              style: const TextStyle(
                color: AppColors.muted,
                height: 1.4,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
