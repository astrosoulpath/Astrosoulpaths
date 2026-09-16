import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_manual_kundli_report.dart';
import '../../data/astrologer_manual_kundli_report_api.dart';
import 'kundli_pdf_preview_screen.dart';

class AstrologerManualKundliReportEditorScreen extends StatefulWidget {
  const AstrologerManualKundliReportEditorScreen({
    super.key,
    required this.callSessionId,
    required this.customerName,
  });

  final String callSessionId;
  final String customerName;

  @override
  State<AstrologerManualKundliReportEditorScreen> createState() =>
      _AstrologerManualKundliReportEditorScreenState();
}

class _AstrologerManualKundliReportEditorScreenState
    extends State<AstrologerManualKundliReportEditorScreen> {
  final _api = AstrologerManualKundliReportApi();

  final _titleController = TextEditingController();
  final _summaryController = TextEditingController();
  final _characterController = TextEditingController();
  final _careerController = TextEditingController();
  final _marriageController = TextEditingController();
  final _financeController = TextEditingController();
  final _healthController = TextEditingController();
  final _remediesController = TextEditingController();
  final _notesController = TextEditingController();

  AstrologerManualKundliReport? _report;

  List<AstrologerManualKundliReportAttachment> _attachments = const [];

  bool _uploadingAttachment = false;

  bool _loadingAttachments = false;

  String? _deletingAttachmentId;

  bool _loading = true;
  bool _saving = false;
  bool _finalizing = false;

  String _error = '';

  @override
  void initState() {
    super.initState();
    _loadDraft();
  }

  @override
  void dispose() {
    _api.close();

    _titleController.dispose();
    _summaryController.dispose();
    _characterController.dispose();
    _careerController.dispose();
    _marriageController.dispose();
    _financeController.dispose();
    _healthController.dispose();
    _remediesController.dispose();
    _notesController.dispose();

    super.dispose();
  }

  Future<void> _loadDraft() async {
    final sessionId = widget.callSessionId.trim();

    if (sessionId.isEmpty) {
      setState(() {
        _loading = false;
        _error = 'Consultation session is missing.';
      });
      return;
    }

    try {
      final report = await _api.createOrGetDraft(callSessionId: sessionId);

      if (!mounted) {
        return;
      }

      _applyReport(report);

      setState(() {
        _report = report;
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
        _error = 'Unable to open professional Kundli report.';
      });
    }
  }

  void _applyReport(AstrologerManualKundliReport report) {
    _titleController.text = report.title ?? '';
    _summaryController.text = report.summary ?? '';
    _characterController.text = report.character ?? '';
    _careerController.text = report.career ?? '';
    _marriageController.text = report.marriage ?? '';
    _financeController.text = report.finance ?? '';
    _healthController.text = report.health ?? '';
    _remediesController.text = report.remedies ?? '';
    _notesController.text = report.notes ?? '';
  }

  Future<bool> _saveDraft({bool showMessage = true}) async {
    final report = _report;

    if (report == null || report.isFinal || _saving) {
      return false;
    }

    setState(() {
      _saving = true;
    });

    try {
      final updated = await _api.updateDraft(
        reportId: report.id,
        title: _value(_titleController),
        summary: _value(_summaryController),
        character: _value(_characterController),
        career: _value(_careerController),
        marriage: _value(_marriageController),
        finance: _value(_financeController),
        health: _value(_healthController),
        remedies: _value(_remediesController),
        notes: _value(_notesController),
      );

      if (!mounted) {
        return false;
      }

      setState(() {
        _report = updated;
      });

      if (showMessage) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Draft saved successfully.')),
        );
      }

      return true;
    } on AstrologerManualKundliReportApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }

      return false;
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to save Kundli report draft.')),
        );
      }

      return false;
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  String? _value(TextEditingController controller) {
    final value = controller.text.trim();
    return value.isEmpty ? null : value;
  }

  Future<void> _finalizeReport() async {
    final report = _report;

    if (report == null || report.isFinal || _finalizing || _saving) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Finalize report?'),
          content: const Text(
            'After finalizing, this report will become visible to the customer '
            'and normal editing will be locked.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Finalize'),
            ),
          ],
        );
      },
    );

    if (confirmed != true || !mounted) {
      return;
    }

    final saved = await _saveDraft(showMessage: false);

    if (!saved || !mounted) {
      return;
    }

    final latest = _report;

    if (latest == null || latest.isFinal) {
      return;
    }

    setState(() {
      _finalizing = true;
    });

    try {
      final finalized = await _api.finalize(reportId: latest.id);

      if (!mounted) {
        return;
      }

      setState(() {
        _report = finalized;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Professional Kundli report finalized and ready for customer.',
          ),
        ),
      );
    } on AstrologerManualKundliReportApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _finalizing = false;
        });
      }
    }
  }

  Future<void> _loadAttachments() async {
    final report = _report;

    if (report == null || _loadingAttachments) {
      return;
    }

    setState(() {
      _loadingAttachments = true;
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
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingAttachments = false;
        });
      }
    }
  }

  Future<void> _pickAttachment() async {
    final report = _report;

    if (report == null || report.isFinal || _uploadingAttachment) {
      return;
    }

    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png'],
      allowMultiple: false,
      withData: true,
    );

    if (result == null || result.files.isEmpty || !mounted) {
      return;
    }

    final file = result.files.single;
    final bytes = file.bytes;

    if (bytes == null || bytes.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to read the selected file.')),
      );
      return;
    }

    if (bytes.length > 10 * 1024 * 1024) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attachment must be 10 MB or smaller.')),
      );
      return;
    }

    setState(() {
      _uploadingAttachment = true;
    });

    try {
      await _api.uploadAttachment(
        reportId: report.id,
        fileName: file.name,
        bytes: bytes,
      );

      if (!mounted) {
        return;
      }

      await _loadAttachments();

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attachment uploaded successfully.')),
      );
    } on AstrologerManualKundliReportApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to upload attachment.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAttachment = false;
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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attachment URL is unavailable.')),
        );
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

  Future<void> _deleteAttachment(
    AstrologerManualKundliReportAttachment attachment,
  ) async {
    final report = _report;

    if (report == null || report.isFinal || _deletingAttachmentId != null) {
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Remove attachment?'),
        content: Text(
          'Remove "${attachment.fileName}" from this draft report?',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(dialogContext).pop(false);
            },
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.of(dialogContext).pop(true);
            },
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _deletingAttachmentId = attachment.id;
    });

    try {
      await _api.deleteAttachment(
        reportId: report.id,
        attachmentId: attachment.id,
      );

      if (!mounted) {
        return;
      }

      await _loadAttachments();
    } on AstrologerManualKundliReportApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
    } finally {
      if (mounted) {
        setState(() {
          _deletingAttachmentId = null;
        });
      }
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

  Widget _attachmentsSection({required bool locked}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.15)),
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
                  'Report Attachments',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w900),
                ),
              ),
              if (!locked)
                TextButton.icon(
                  onPressed: _uploadingAttachment ? null : _pickAttachment,
                  icon: _uploadingAttachment
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.add_rounded, size: 18),
                  label: Text(_uploadingAttachment ? 'Uploading...' : 'Add'),
                ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'PDF, JPG or PNG • maximum 10 MB',
            style: TextStyle(color: AppColors.muted, fontSize: 11),
          ),
          const SizedBox(height: 12),
          if (_loadingAttachments)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(12),
                child: CircularProgressIndicator(color: AppColors.gold),
              ),
            )
          else if (_attachments.isEmpty)
            const Text(
              'No attachments added.',
              style: TextStyle(color: AppColors.muted),
            )
          else
            ..._attachments.map(
              (attachment) => ListTile(
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
                onTap: () {
                  _openAttachment(attachment);
                },
                trailing: locked
                    ? const Icon(
                        Icons.open_in_new_rounded,
                        size: 18,
                        color: AppColors.muted,
                      )
                    : IconButton(
                        tooltip: 'Remove attachment',
                        onPressed: _deletingAttachmentId == attachment.id
                            ? null
                            : () {
                                _deleteAttachment(attachment);
                              },
                        icon: _deletingAttachmentId == attachment.id
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.delete_outline_rounded),
                      ),
              ),
            ),
        ],
      ),
    );
  }

  Future<void> _openFinalReportPdf() async {
    final report = _report;

    if (report == null || !report.isFinal) {
      return;
    }

    try {
      final bytes = await _api.downloadReportPdf(reportId: report.id);

      if (!mounted) {
        return;
      }

      final rawTitle = (report.title?.trim().isNotEmpty ?? false)
          ? report.title!.trim()
          : 'professional-kundli-report';

      var safeTitle = rawTitle
          .replaceAll(RegExp(r'[^a-zA-Z0-9_-]+'), '-')
          .replaceAll(RegExp(r'-+'), '-')
          .replaceAll(RegExp(r'^-|-$'), '')
          .toLowerCase();

      if (safeTitle.isEmpty) {
        safeTitle = 'professional-kundli-report';
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              KundliPdfPreviewScreen(bytes: bytes, fileName: '$safeTitle.pdf'),
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
    final report = _report;
    final locked = report?.isFinal ?? false;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(title: const Text('Professional Kundli Report')),
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
                    const Icon(
                      Icons.error_outline_rounded,
                      color: Colors.redAccent,
                      size: 42,
                    ),
                    const SizedBox(height: 12),
                    Text(_error, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _loadDraft,
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          : SafeArea(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.15),
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
                            Icons.description_outlined,
                            color: AppColors.gold,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.customerName,
                                style: const TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                locked
                                    ? 'FINAL • Visible to customer'
                                    : 'DRAFT • Private to astrologer',
                                style: TextStyle(
                                  color: locked
                                      ? Colors.greenAccent
                                      : AppColors.gold,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 12,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  _field(
                    controller: _titleController,
                    label: 'Report Title',
                    hint: 'Professional Kundli consultation report',
                    locked: locked,
                    maxLines: 1,
                  ),
                  _field(
                    controller: _summaryController,
                    label: 'Overall Summary',
                    hint: 'Write your overall astrological assessment...',
                    locked: locked,
                  ),
                  _field(
                    controller: _characterController,
                    label: 'Character & Personality',
                    hint: 'Your interpretation of personality and nature...',
                    locked: locked,
                  ),
                  _field(
                    controller: _careerController,
                    label: 'Career',
                    hint: 'Career observations, strengths and timing...',
                    locked: locked,
                  ),
                  _field(
                    controller: _marriageController,
                    label: 'Marriage & Relationships',
                    hint: 'Relationship and marriage observations...',
                    locked: locked,
                  ),
                  _field(
                    controller: _financeController,
                    label: 'Finance',
                    hint: 'Financial tendencies and guidance...',
                    locked: locked,
                  ),
                  _field(
                    controller: _healthController,
                    label: 'Health',
                    hint: 'General astrological wellness observations...',
                    locked: locked,
                  ),
                  _field(
                    controller: _remediesController,
                    label: 'Remedies',
                    hint: 'Suggested spiritual or traditional remedies...',
                    locked: locked,
                  ),
                  _field(
                    controller: _notesController,
                    label: 'Astrologer Notes',
                    hint: 'Additional professional notes...',
                    locked: locked,
                  ),
                  _attachmentsSection(locked: locked),
                  const SizedBox(height: 8),
                  if (!locked) ...[
                    FilledButton.icon(
                      onPressed: _saving || _finalizing
                          ? null
                          : () => _saveDraft(),
                      icon: _saving
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(_saving ? 'Saving...' : 'Save Draft'),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: _saving || _finalizing
                          ? null
                          : _finalizeReport,
                      icon: _finalizing
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.verified_outlined),
                      label: Text(
                        _finalizing ? 'Finalizing...' : 'Finalize for Customer',
                      ),
                    ),
                  ] else
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.08),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(
                              color: Colors.greenAccent.withValues(alpha: 0.25),
                            ),
                          ),
                          child: const Row(
                            children: [
                              Icon(
                                Icons.verified_rounded,
                                color: Colors.greenAccent,
                              ),
                              SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'This report is finalized and visible to the customer.',
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton.icon(
                          onPressed: _openFinalReportPdf,
                          icon: const Icon(Icons.picture_as_pdf_outlined),
                          label: const Text('View PDF'),
                        ),
                      ],
                    ),
                ],
              ),
            ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required String hint,
    required bool locked,
    int maxLines = 5,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: controller,
        readOnly: locked,
        minLines: maxLines == 1 ? 1 : 3,
        maxLines: maxLines,
        maxLength: label == 'Report Title' ? 200 : 20000,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          alignLabelWithHint: maxLines > 1,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
