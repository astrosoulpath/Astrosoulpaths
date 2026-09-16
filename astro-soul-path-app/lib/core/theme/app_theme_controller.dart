import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract final class AppThemeController {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _darkModeKey = 'asp_dark_mode';

  static final ValueNotifier<ThemeMode> themeMode = ValueNotifier<ThemeMode>(
    ThemeMode.dark,
  );

  static bool get isDarkMode => themeMode.value == ThemeMode.dark;

  static Future<void> loadCached() async {
    final stored = await _storage.read(key: _darkModeKey);

    if (stored == null) {
      return;
    }

    themeMode.value = stored == 'true' ? ThemeMode.dark : ThemeMode.light;
  }

  static Future<void> setDarkMode(bool enabled) async {
    final nextMode = enabled ? ThemeMode.dark : ThemeMode.light;

    if (themeMode.value != nextMode) {
      themeMode.value = nextMode;
    }

    await _storage.write(key: _darkModeKey, value: enabled.toString());
  }
}
