import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  static const String _productionOverride = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    final override = _productionOverride.trim();
    if (kReleaseMode) return validateReleaseBaseUrl(override);

    // Production / real-device URL always takes priority.
    if (override.isNotEmpty) {
      return _normalize(override);
    }

    // Flutter Web on the development PC.
    if (kIsWeb) {
      return 'http://127.0.0.1:4000';
    }

    switch (defaultTargetPlatform) {
      // Android Emulator -> host machine.
      case TargetPlatform.android:
        return 'http://10.0.2.2:4000';

      // iOS Simulator / desktop development.
      case TargetPlatform.iOS:
      case TargetPlatform.macOS:
      case TargetPlatform.windows:
      case TargetPlatform.linux:
      case TargetPlatform.fuchsia:
        return 'http://127.0.0.1:4000';
    }
  }

  static const Duration requestTimeout = Duration(seconds: 20);

  /// Release binaries must never silently inherit emulator/development APIs.
  static String validateReleaseBaseUrl(String value) {
    final normalized = _normalize(value);
    final uri = Uri.tryParse(normalized);
    final host =
        uri?.host.toLowerCase().replaceAll('[', '').replaceAll(']', '') ?? '';
    final privateHost = RegExp(
      r'^(localhost$|0\.|127\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::|f[cd][0-9a-f]{2}:|fe[89ab][0-9a-f]:)',
      caseSensitive: false,
    ).hasMatch(host);
    if (uri == null ||
        uri.scheme != 'https' ||
        !uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        host.isEmpty ||
        (!host.contains('.') && !host.contains(':')) ||
        privateHost ||
        ['.localhost', '.local', '.internal', '.invalid'].any(host.endsWith)) {
      throw StateError(
        'A public HTTPS API_BASE_URL is required for release builds.',
      );
    }
    return normalized;
  }

  static String _normalize(String value) {
    var result = value.trim();

    while (result.endsWith('/')) {
      result = result.substring(0, result.length - 1);
    }

    return result;
  }
}
