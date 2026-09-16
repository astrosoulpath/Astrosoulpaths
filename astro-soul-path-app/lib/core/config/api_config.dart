import 'package:flutter/foundation.dart';

class ApiConfig {
  ApiConfig._();

  static const String _productionOverride = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: '',
  );

  static String get baseUrl {
    final override = _productionOverride.trim();

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

  static String _normalize(String value) {
    var result = value.trim();

    while (result.endsWith('/')) {
      result = result.substring(0, result.length - 1);
    }

    return result;
  }
}
