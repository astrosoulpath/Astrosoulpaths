import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_manual_kundli_report.dart';
import '../../data/astrologer_manual_kundli_report_api.dart';
import 'kundli_pdf_preview_screen.dart';

class CustomerAstrologerKundliReportDetailScreen extends StatefulWidget {
  const CustomerAstrologerKundliReportDetailScreen({
    super.key,
    required this.report,
  });

  final AstrologerManualKundliReport report;

  @override
  State<CustomerAstrologerKundliReportDetailScreen> createState() =>
      _CustomerAstrologerKundliReportDetailScreenState();
}

class _CustomerAstrologerKundliReportDetailScreenState
    extends State<CustomerAstrologerKundliReportDetailScreen> {
  final _api = AstrologerManualKundliReportApi();

  bool _loadingAttachments = false;
  String _attachmentError = '';

  List<AstrologerManualKundliReportAttachment> _attachments = const [];

  AstrologerManualKundliReport get report => widget.report;

  @override
  void initState() {
    super.initState();

    if (report.isFinal) {
      _loadAttachments();
    }
  }

  @override
  void dispose() {
    _api.close();
    super.dispose();
  }

  Future<void> _loadAttachments() async {
    if (!report.isFinal || _loadingAttachments) {
      return;
    }

    setState(() {
      _loadingAttachments = true;
      _attachmentError = '';
    });

    try {
      final attachments = await _api.getAttachments(reportId: report.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _attachments = attachments;
      });
    } on AstrologerManualKundliReportApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _attachmentError = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _attachmentError = 'Unable to load report attachments.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingAttachments = false;
        });
      }
    }
  }

  Future<void> _openAttachment(
    AstrologerManualKundliReportAttachment attachment,
  ) async {
    final rawUrl = attachment.storageUrl.trim();
    final uri = Uri.tryParse(rawUrl);

    if (uri == null || (uri.scheme != 'https' && uri.scheme != 'http')) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attachment link is unavailable.')),
      );
      return;
    }

    final mimeType = attachment.mimeType.trim().toLowerCase();
    final isImage = mimeType == 'image/jpeg' || mimeType == 'image/png';

    if (isImage) {
      try {
        final imageBytes = await _api.downloadAttachmentBytes(
          signedUrl: rawUrl,
          expectedMimeType: mimeType,
        );

        if (!mounted) {
          return;
        }

        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) => _KundliAttachmentImagePreview(
              title: attachment.fileName,
              imageBytes: imageBytes,
            ),
          ),
        );
      } on AstrologerManualKundliReportApiException catch (error) {
        if (!mounted) {
          return;
        }

        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }

      return;
    }

    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);

    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open attachment.')),
      );
    }
  }

  String _attachmentSize(int bytes) {
    if (bytes >= 1024 * 1024) {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
    }

    if (bytes >= 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)} KB';
    }

    return '$bytes B';
  }

  Future<void> _openReportPdf() async {
    if (!report.isFinal) {
      return;
    }

    try {
      final bytes = await _api.downloadReportPdf(reportId: report.id);

      if (!mounted) {
        return;
      }

      final safeTitle = (report.title?.trim().isNotEmpty ?? false)
          ? report.title!.trim()
          : 'professional-kundli-report';

      final normalizedTitle = safeTitle
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '-')
          .replaceAll(RegExp(r'-+'), '-')
          .replaceAll(RegExp(r'^-|-$'), '')
          .toLowerCase();

      final fileName = '$normalizedTitle.pdf';

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              KundliPdfPreviewScreen(bytes: bytes, fileName: fileName),
        ),
      );
    } on AstrologerManualKundliReportApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(error.message)));
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Unable to open the professional Kundli PDF.'),
          ),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!report.isFinal) {
      return Scaffold(
        appBar: AppBar(title: const Text('Kundli Report')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'This professional report is not available yet.',
              textAlign: TextAlign.center,
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: const Text('Astrologer Report'),
        actions: [
          IconButton(
            tooltip: 'View PDF',
            onPressed: report.isFinal ? _openReportPdf : null,
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadAttachments,
        child: SafeArea(
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
            children: [
              _header(),
              const SizedBox(height: 18),

              if (_has(report.summary))
                _section(
                  icon: Icons.auto_awesome_outlined,
                  title: 'Overall Summary',
                  value: report.summary!,
                ),

              if (_has(report.character))
                _section(
                  icon: Icons.person_outline_rounded,
                  title: 'Character & Personality',
                  value: report.character!,
                ),

              if (_has(report.career))
                _section(
                  icon: Icons.work_outline_rounded,
                  title: 'Career',
                  value: report.career!,
                ),

              if (_has(report.marriage))
                _section(
                  icon: Icons.favorite_border_rounded,
                  title: 'Marriage & Relationships',
                  value: report.marriage!,
                ),

              if (_has(report.finance))
                _section(
                  icon: Icons.account_balance_wallet_outlined,
                  title: 'Finance',
                  value: report.finance!,
                ),

              if (_has(report.health))
                _section(
                  icon: Icons.health_and_safety_outlined,
                  title: 'Health',
                  value: report.health!,
                ),

              if (_has(report.remedies))
                _section(
                  icon: Icons.self_improvement_outlined,
                  title: 'Remedies',
                  value: report.remedies!,
                ),

              if (_has(report.notes))
                _section(
                  icon: Icons.notes_rounded,
                  title: 'Astrologer Notes',
                  value: report.notes!,
                ),

              if (!_hasAnyContent())
                Container(
                  margin: const EdgeInsets.only(bottom: 14),
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Text(
                    'The astrologer finalized this report without '
                    'additional written sections.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.muted, height: 1.5),
                  ),
                ),

              _attachmentsCard(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _attachmentsCard() {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.attach_file_rounded, color: AppColors.gold),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Astrologer Attachments',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                ),
              ),
              IconButton(
                tooltip: 'Refresh attachments',
                onPressed: _loadingAttachments ? null : _loadAttachments,
                icon: const Icon(Icons.refresh_rounded),
              ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Files attached to this finalized professional report.',
            style: TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const SizedBox(height: 12),

          if (_loadingAttachments)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(16),
                child: CircularProgressIndicator(color: AppColors.gold),
              ),
            )
          else if (_attachmentError.isNotEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _attachmentError,
                  style: const TextStyle(color: Colors.redAccent),
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _loadAttachments,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Retry'),
                ),
              ],
            )
          else if (_attachments.isEmpty)
            const Text(
              'No attachments were added to this report.',
              style: TextStyle(color: AppColors.muted),
            )
          else
            ..._attachments.map(
              (attachment) => Material(
                type: MaterialType.transparency,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Icon(
                    attachment.mimeType == 'application/pdf'
                        ? Icons.picture_as_pdf_outlined
                        : Icons.image_outlined,
                    color: AppColors.gold,
                  ),
                  title: Text(
                    attachment.fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  subtitle: Text(
                    _attachmentSize(attachment.sizeBytes),
                    style: const TextStyle(color: AppColors.muted),
                  ),
                  trailing: const Icon(
                    Icons.open_in_new_rounded,
                    color: AppColors.muted,
                    size: 18,
                  ),
                  onTap: () {
                    _openAttachment(attachment);
                  },
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _header() {
    final title = report.title?.trim();

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.16)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              color: Colors.greenAccent.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.verified_rounded,
              color: Colors.greenAccent,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title != null && title.isNotEmpty
                      ? title
                      : 'Professional Kundli Report',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Prepared by your astrologer',
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                ),
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 9,
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
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _section({
    required IconData icon,
    required String title,
    required String value,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.10)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.gold, size: 20),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SelectableText(
            value.trim(),
            style: const TextStyle(height: 1.55, fontSize: 14),
          ),
        ],
      ),
    );
  }

  bool _has(String? value) {
    return value?.trim().isNotEmpty ?? false;
  }

  bool _hasAnyContent() {
    return _has(report.summary) ||
        _has(report.character) ||
        _has(report.career) ||
        _has(report.marriage) ||
        _has(report.finance) ||
        _has(report.health) ||
        _has(report.remedies) ||
        _has(report.notes);
  }
}

class _KundliAttachmentImagePreview extends StatelessWidget {
  const _KundliAttachmentImagePreview({
    required this.title,
    required this.imageBytes,
  });

  final String title;
  final Uint8List imageBytes;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: Center(
          child: InteractiveViewer(
            minScale: 0.5,
            maxScale: 5,
            child: Image.memory(
              imageBytes,
              fit: BoxFit.contain,
              gaplessPlayback: true,
              errorBuilder: (context, error, stackTrace) {
                return const Padding(
                  padding: EdgeInsets.all(24),
                  child: Text(
                    'Unable to display this attachment.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
