import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';

int _previewSequence = 0;

/// pdfrx caches by source name, not by PDF bytes or report version.
String newKundliPdfPreviewSourceName() =>
    'kundli-preview-${++_previewSequence}';

bool isValidKundliPdf(Uint8List bytes) {
  if (bytes.length < 16) return false;
  final header = String.fromCharCodes(bytes.take(8));
  final tail = String.fromCharCodes(
    bytes.skip(bytes.length > 1024 ? bytes.length - 1024 : 0),
  );
  return RegExp(r'^%PDF-\d\.\d').hasMatch(header) && tail.contains('%%EOF');
}

String safeKundliPdfName(String input) {
  var name = input
      .split(RegExp(r'[/\\]'))
      .last
      .replaceAll(RegExp(r'[^a-zA-Z0-9._ -]'), '_');
  name = name
      .replaceAll(RegExp(r'\.pdf$', caseSensitive: false), '')
      .replaceAll(RegExp(r'^\.+|[. ]+$'), '')
      .trim();
  if (name.isEmpty) name = 'kundli-report';
  if (name.length > 80) name = name.substring(0, 80);
  return '$name.pdf';
}

typedef KundliPdfSave = Future<String?> Function(Uint8List bytes, String name);

Future<Directory> kundliPdfTemporaryDirectory() async {
  final root = await getTemporaryDirectory();
  // Give external viewers time to read the file; remove only our old cache dirs.
  await for (final entry in root.list(followLinks: false)) {
    final name = entry.path.split(Platform.pathSeparator).last;
    if (entry is Directory && name.startsWith('asp-kundli-')) {
      try {
        if (DateTime.now().difference((await entry.stat()).modified) >
            const Duration(days: 1)) {
          await entry.delete(recursive: true);
        }
      } catch (_) {
        /* Cache cleanup must not interrupt an export. */
      }
    }
  }
  return root.createTemp('asp-kundli-');
}

Future<String?> saveKundliPdf(Uint8List bytes, String name) async {
  if (!isValidKundliPdf(bytes)) throw const FormatException('Invalid PDF');
  // On Android/iOS the existing plugin writes bytes before reporting completion.
  final safeName = safeKundliPdfName(name);
  if (Platform.isAndroid) {
    return const MethodChannel(
      'asp/kundli_pdf_export',
    ).invokeMethod<String>('savePdf', {'bytes': bytes, 'name': safeName});
  }
  // iOS file_picker stages in Documents; unique names prevent overwriting data.
  final exportName =
      '${safeName.substring(0, safeName.length - 4)}-${DateTime.now().microsecondsSinceEpoch}.pdf';
  final staging = Platform.isIOS
      ? File('${(await getApplicationDocumentsDirectory()).path}/$exportName')
      : null;
  String? destination;
  try {
    destination = await FilePicker.platform.saveFile(
      dialogTitle: 'Save Kundli PDF',
      fileName: exportName,
      type: FileType.custom,
      allowedExtensions: ['pdf'],
      bytes: bytes,
    );
    if (destination != null && staging != null) {
      final written = await staging.readAsBytes();
      if (written.length != bytes.length) {
        throw const FormatException('Incomplete export');
      }
      for (var index = 0; index < bytes.length; index++) {
        if (written[index] != bytes[index]) {
          throw const FormatException('Export content mismatch');
        }
      }
    }
    return destination;
  } finally {
    // Delete only this operation's private staging file, never its exported copy.
    try {
      if (staging != null &&
          destination != staging.path &&
          await staging.exists()) {
        await staging.delete();
      }
    } catch (_) {
      /* A cleanup failure must not misreport a completed export. */
    }
  }
}
