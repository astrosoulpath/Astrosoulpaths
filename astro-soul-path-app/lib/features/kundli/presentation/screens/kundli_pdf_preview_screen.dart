import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:open_filex/open_filex.dart';
import '../../data/kundli_pdf_export.dart';
import 'package:share_plus/share_plus.dart';

class KundliPdfPreviewScreen extends StatefulWidget {
  const KundliPdfPreviewScreen({
    super.key,
    required this.bytes,
    required this.fileName,
    this.savePdf,
    this.previewBuilder,
  });

  final Uint8List bytes;
  final String fileName;
  final KundliPdfSave? savePdf;
  final Widget Function(Uint8List bytes)? previewBuilder;

  @override
  State<KundliPdfPreviewScreen> createState() => _KundliPdfPreviewScreenState();
}

class _KundliPdfPreviewScreenState extends State<KundliPdfPreviewScreen> {
  late final Uint8List _bytes = Uint8List.fromList(widget.bytes);
  late final String _name = safeKundliPdfName(widget.fileName);
  late final String _previewSourceName = newKundliPdfPreviewSourceName();
  bool get _valid => isValidKundliPdf(_bytes);
  bool _isSaving = false;
  bool _isSharing = false;
  int? _pageCount;

  Future<void> _openPdf() async {
    if (_isSaving || _isSharing || !_valid) return;
    setState(() => _isSharing = true);
    try {
      final directory = await kundliPdfTemporaryDirectory();
      final file = File('${directory.path}/$_name');
      await file.writeAsBytes(_bytes, flush: true);
      final result = await OpenFilex.open(file.path, type: 'application/pdf');
      if (result.type != ResultType.done) {
        throw const FileSystemException('Open failed');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Unable to open PDF. Please install a PDF viewer or save to Files.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSharing = false);
    }
  }

  Future<void> _downloadPdf() async {
    if (_isSaving || _isSharing || !_valid) {
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final result = await (widget.savePdf ?? saveKundliPdf)(_bytes, _name);
      if (!mounted) return;
      if (result == null) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('PDF save cancelled.')));
        return;
      }
      if (result.trim().isEmpty) throw const FormatException('Save failed');
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: const Text('PDF saved successfully')));
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Unable to download PDF. Please try again.'),
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  Future<void> _sharePdf() async {
    if (_isSharing || _isSaving || !_valid) {
      return;
    }

    setState(() {
      _isSharing = true;
    });

    try {
      final directory = await kundliPdfTemporaryDirectory();
      final tempFile = File('${directory.path}/$_name');

      await tempFile.writeAsBytes(_bytes, flush: true);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(tempFile.path, mimeType: 'application/pdf')],
          title: 'Astro Soul Path Kundli',
          subject: 'My Kundli Report',
          sharePositionOrigin: const Rect.fromLTWH(1, 1, 1, 1),
        ),
      );
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Unable to share PDF. Please try again.'),
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isSharing = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    const navy = Color(0xFF03264A);
    const gold = Color(0xFFFFC857);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        bottom: _pageCount == null
            ? null
            : PreferredSize(
                preferredSize: const Size.fromHeight(24),
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Text(
                    '$_pageCount pages',
                    style: const TextStyle(color: Colors.white),
                  ),
                ),
              ),
        backgroundColor: navy,
        foregroundColor: Colors.white,
        iconTheme: const IconThemeData(color: Colors.white),
        actionsIconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        titleSpacing: 0,
        title: const Text(
          'Kundli PDF',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Open PDF',
            color: Colors.white,
            disabledColor: Colors.white,
            onPressed: _isSharing || _isSaving || !_valid ? null : _openPdf,
            icon: const Icon(Icons.open_in_new_rounded),
          ),
          IconButton(
            tooltip: 'Share',
            color: Colors.white,
            disabledColor: Colors.white,
            onPressed: _isSharing || _isSaving || !_valid ? null : _sharePdf,
            icon: _isSharing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Icon(Icons.share_rounded),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: !_valid
          ? const Center(
              child: Text(
                'Invalid or incomplete PDF. Please reopen the report.',
              ),
            )
          : widget.previewBuilder?.call(_bytes) ??
                PdfViewer.data(
                  _bytes,
                  sourceName: _previewSourceName,
                  params: PdfViewerParams(
                    onDocumentChanged: (document) {
                      if (mounted) {
                        setState(() => _pageCount = document?.pages.length);
                      }
                    },
                    errorBannerBuilder: (context, error, stack, document) =>
                        const Center(
                          child: Text(
                            'Unable to render PDF. Please reopen the report.',
                          ),
                        ),
                    backgroundColor: Color(0xFFF4F5F8),
                    margin: 12,
                  ),
                ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            boxShadow: [
              BoxShadow(
                blurRadius: 12,
                offset: Offset(0, -2),
                color: Color(0x18000000),
              ),
            ],
          ),
          child: SizedBox(
            // Minimum touch target without clipping accessibility text.
            // Button padding handles larger text.
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: gold,
                foregroundColor: navy,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: _isSaving || _isSharing || !_valid
                  ? null
                  : _downloadPdf,
              icon: _isSaving
                  ? const SizedBox(
                      width: 19,
                      height: 19,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: navy,
                      ),
                    )
                  : const Icon(Icons.download_rounded),
              label: Text(
                _isSaving ? 'Downloading...' : 'Download PDF',
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
