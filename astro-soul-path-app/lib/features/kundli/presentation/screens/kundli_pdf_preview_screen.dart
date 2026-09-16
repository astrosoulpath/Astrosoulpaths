import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:public_file_saver/public_file_saver.dart';
import 'package:share_plus/share_plus.dart';

class KundliPdfPreviewScreen extends StatefulWidget {
  const KundliPdfPreviewScreen({
    super.key,
    required this.bytes,
    required this.fileName,
  });

  final Uint8List bytes;
  final String fileName;

  @override
  State<KundliPdfPreviewScreen> createState() => _KundliPdfPreviewScreenState();
}

class _KundliPdfPreviewScreenState extends State<KundliPdfPreviewScreen> {
  bool _isSaving = false;
  bool _isSharing = false;

  Future<void> _downloadPdf() async {
    if (_isSaving) {
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final saver = PublicFileSaver();

      final result = await saver.saveBytes(
        bytes: widget.bytes,
        fileName: widget.fileName,
        mimeType: 'application/pdf',
        subDir: Platform.isAndroid ? 'Astro Soul Path' : null,
      );

      if (!mounted) {
        return;
      }

      if (result == null || !result.isSuccess) {
        throw Exception('PDF save failed');
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              Platform.isAndroid
                  ? 'Kundli PDF saved in Downloads/Astro Soul Path.'
                  : 'Kundli PDF saved to Files.',
            ),
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
    if (_isSharing) {
      return;
    }

    setState(() {
      _isSharing = true;
    });

    try {
      final tempDirectory = await getTemporaryDirectory();

      final tempFile = File('${tempDirectory.path}/${widget.fileName}');

      await tempFile.writeAsBytes(widget.bytes, flush: true);

      await SharePlus.instance.share(
        ShareParams(
          files: [XFile(tempFile.path, mimeType: 'application/pdf')],
          title: 'Astro Soul Path Kundli',
          subject: 'My Kundli Report',
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
      backgroundColor: const Color(0xFFF4F5F8),
      appBar: AppBar(
        backgroundColor: navy,
        foregroundColor: Colors.white,
        elevation: 0,
        titleSpacing: 0,
        title: const Text(
          'Kundli PDF',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          IconButton(
            tooltip: 'Share',
            onPressed: _isSharing ? null : _sharePdf,
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
      body: PdfViewer.data(
        widget.bytes,
        sourceName: widget.fileName,
        params: const PdfViewerParams(
          backgroundColor: Color(0xFFF4F5F8),
          margin: 12,
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                blurRadius: 12,
                offset: Offset(0, -2),
                color: Color(0x18000000),
              ),
            ],
          ),
          child: SizedBox(
            height: 50,
            child: FilledButton.icon(
              style: FilledButton.styleFrom(
                backgroundColor: gold,
                foregroundColor: navy,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              onPressed: _isSaving ? null : _downloadPdf,
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
