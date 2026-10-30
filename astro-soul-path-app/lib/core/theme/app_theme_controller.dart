import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract final class AppThemeController {
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  static const String _darkModeKey = 'asp_dark_mode';
  static const String _appearanceKey = 'asp_appearance_v2';
  static bool _loaded = false;
  static bool _explicit = false;
  static int _selection = 0;
  static Future<void>? _writes;

  static final ValueNotifier<ThemeMode> themeMode = ValueNotifier<ThemeMode>(
    ThemeMode.system,
  );

  static bool get isDarkMode =>
      themeMode.value == ThemeMode.dark ||
      (themeMode.value == ThemeMode.system &&
          WidgetsBinding.instance.platformDispatcher.platformBrightness ==
              Brightness.dark);

  static Future<void> loadCached() async {
    if (_loaded) return;
    _loaded = true;
    final selection = _selection;
    try {
      final appearance = await _storage.read(key: _appearanceKey);
      if (selection != _selection) return;
      if (appearance != null &&
          ThemeMode.values.any((m) => m.name == appearance)) {
        _explicit = true;
        themeMode.value = ThemeMode.values.firstWhere(
          (m) => m.name == appearance,
        );
        return;
      }
      final stored = await _storage.read(key: _darkModeKey);
      if (selection != _selection) return;

      if (stored == null) {
        return;
      }

      _explicit = true;
      themeMode.value = stored == 'true' ? ThemeMode.dark : ThemeMode.light;
    } catch (_) {
      _loaded = false;
      // Storage failure must not prevent authentication/app startup.
      debugPrint('Appearance preference storage is temporarily unavailable.');
    }
  }

  @visibleForTesting
  static void resetCacheForTesting() {
    _loaded = false;
    _explicit = false;
    _selection++;
    _writes = null;
    themeMode.value = ThemeMode.system;
  }

  /// Legacy server bool is only an initial fallback, never an override of a
  /// saved local Light/Dark/System selection during navigation or refresh.
  static Future<void> adoptServerDefault(bool dark) async {
    await loadCached();
    if (!_explicit) themeMode.value = dark ? ThemeMode.dark : ThemeMode.light;
  }

  static Future<void> setThemeMode(ThemeMode mode) async {
    final previous = themeMode.value;
    final previousExplicit = _explicit;
    final selection = ++_selection;
    _explicit = true;
    themeMode.value = mode;
    final previousWrite = _writes;
    Future<void> persist() async {
      if (previousWrite != null) {
        try {
          await previousWrite;
        } catch (_) {
          /* A later choice may retry. */
        }
      }
      await _storage.write(key: _appearanceKey, value: mode.name);
    }

    final write = persist();
    _writes = write;
    try {
      await write;
    } catch (_) {
      if (selection == _selection) {
        _explicit = previousExplicit;
        themeMode.value = previous;
      }
      rethrow;
    }
  }

  static Future<void> setDarkMode(bool enabled) async {
    await setThemeMode(enabled ? ThemeMode.dark : ThemeMode.light);
  }
}
