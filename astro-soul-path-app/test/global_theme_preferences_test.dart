import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/theme/app_theme.dart';
import 'package:astro_soul_path/core/theme/app_theme_controller.dart';
import 'package:astro_soul_path/core/localization/preference_translations.dart';
import 'package:astro_soul_path/features/preferences/data/app_preferences.dart';
import 'package:astro_soul_path/features/preferences/data/preferences_api.dart';
import 'package:astro_soul_path/features/preferences/presentation/screens/set_preference_screen.dart';

class FakePreferences extends PreferencesApi {
  bool fail = false;
  Map<String, Object>? saved;
  @override
  Future<AppPreferences> getPreferences() async {
    if (fail) throw const PreferencesApiException('Synthetic failure');
    return const AppPreferences(
      chartStyle: 'SOUTH_INDIAN',
      monthType: 'PURNIMANT',
      darkMode: false,
      hideOuterPlanets: true,
      customCalendar: true,
    );
  }

  @override
  Future<AppPreferences> updatePreferences({
    required String chartStyle,
    required String monthType,
    required bool darkMode,
    required bool hideOuterPlanets,
    required bool customCalendar,
  }) async {
    saved = {
      'chartStyle': chartStyle,
      'monthType': monthType,
      'darkMode': darkMode,
      'hideOuterPlanets': hideOuterPlanets,
      'customCalendar': customCalendar,
    };
    return AppPreferences.fromJson(saved!);
  }

  @override
  void close() {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    AppThemeController.resetCacheForTesting();
  });
  test('Light and Dark have distinct specified semantic palettes', () {
    expect(AppTheme.light.brightness, Brightness.light);
    expect(AppTheme.dark.brightness, Brightness.dark);
    expect(AppTheme.light.scaffoldBackgroundColor, const Color(0xFFFFF9F1));
    expect(AppTheme.dark.scaffoldBackgroundColor, const Color(0xFF080D20));
    expect(AppTheme.dark.colorScheme.surface, const Color(0xFF151B35));
    expect(AppTheme.dark.colorScheme.onSurface, const Color(0xFFF8F5FF));
  });
  for (final mode in ThemeMode.values) {
    test(
      '$mode persists through controller recreation and ignores server refresh',
      () async {
        await AppThemeController.setThemeMode(mode);
        AppThemeController.resetCacheForTesting();
        await AppThemeController.loadCached();
        expect(AppThemeController.themeMode.value, mode);
        await AppThemeController.adoptServerDefault(mode != ThemeMode.dark);
        expect(AppThemeController.themeMode.value, mode);
      },
    );
  }
  test('legacy boolean migrates without resetting saved selection', () async {
    FlutterSecureStorage.setMockInitialValues({'asp_dark_mode': 'true'});
    await AppThemeController.loadCached();
    expect(AppThemeController.themeMode.value, ThemeMode.dark);
  });
  test(
    'rapid appearance changes persist the final requested selection',
    () async {
      await Future.wait([
        AppThemeController.setThemeMode(ThemeMode.dark),
        AppThemeController.setThemeMode(ThemeMode.light),
        AppThemeController.setThemeMode(ThemeMode.system),
      ]);
      AppThemeController.resetCacheForTesting();
      await AppThemeController.loadCached();
      expect(AppThemeController.themeMode.value, ThemeMode.system);
    },
  );
  testWidgets(
    'appearance updates visible routes immediately without resetting on navigation',
    (tester) async {
      await tester.pumpWidget(
        ValueListenableBuilder<ThemeMode>(
          valueListenable: AppThemeController.themeMode,
          builder: (context, mode, _) => MaterialApp(
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: mode,
            home: Builder(
              builder: (context) => Scaffold(
                body: Column(
                  children: [
                    Text(Theme.of(context).brightness.name),
                    TextButton(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (context) => Scaffold(
                            body: Text(Theme.of(context).brightness.name),
                          ),
                        ),
                      ),
                      child: const Text('Next'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
      await AppThemeController.setThemeMode(ThemeMode.dark);
      await tester.pumpAndSettle();
      expect(find.text('dark'), findsOneWidget);
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('dark'), findsOneWidget);
      await AppThemeController.setThemeMode(ThemeMode.light);
      await tester.pumpAndSettle();
      expect(find.text('light'), findsOneWidget);
    },
  );
  test('all 19 non-English locale rows cover every new preference label', () {
    expect(preferenceRows.length, 19);
    for (final row in preferenceRows.entries) {
      expect(
        row.value.split('|').length,
        preferenceKeys.length,
        reason: row.key,
      );
      for (final key in preferenceKeys) {
        expect(
          preferenceTranslation(key, row.key),
          isNotEmpty,
          reason: '${row.key}:$key',
        );
      }
    }
  });
  for (final locale in ['en', 'ar']) {
    for (final mode in [ThemeMode.light, ThemeMode.dark]) {
      testWidgets('preferences $locale $mode at 320dp and large text', (
        tester,
      ) async {
        tester.view.physicalSize = const Size(320, 800);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetDevicePixelRatio);
        await AppThemeController.setThemeMode(mode);
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.light,
            darkTheme: AppTheme.dark,
            themeMode: mode,
            locale: Locale(locale),
            supportedLocales: [Locale(locale)],
            localizationsDelegates: GlobalMaterialLocalizations.delegates,
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: TextScaler.linear(2)),
              child: child!,
            ),
            home: SetPreferenceScreen(api: FakePreferences()),
          ),
        );
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.drag(find.byType(ListView), const Offset(0, -1600));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      });
    }
  }
  testWidgets(
    'reset preserves technical enums and only explicit Save calls backend',
    (tester) async {
      final api = FakePreferences();
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light,
          home: SetPreferenceScreen(api: api),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Reset to Defaults'), 400);
      await tester.tap(find.text('Reset to Defaults'));
      await tester.pumpAndSettle();
      expect(api.saved, isNull);
      expect(AppThemeController.themeMode.value, ThemeMode.light);
      await tester.tap(find.text('Save Preferences'));
      await tester.pumpAndSettle();
      expect(api.saved, {
        'chartStyle': 'NORTH_INDIAN',
        'monthType': 'AMANT',
        'darkMode': false,
        'hideOuterPlanets': false,
        'customCalendar': false,
      });
      expect(find.text('Preferences saved.'), findsOneWidget);
    },
  );
  testWidgets(
    'load error does not enable overwriting unknown server preferences',
    (tester) async {
      final api = FakePreferences()..fail = true;
      await tester.pumpWidget(MaterialApp(home: SetPreferenceScreen(api: api)));
      await tester.pumpAndSettle();
      expect(find.text('Preferences could not be loaded.'), findsOneWidget);
      api.fail = false;
      await tester.tap(find.text('Try again'));
      await tester.pumpAndSettle();
      expect(find.text('Preferences could not be loaded.'), findsNothing);
    },
  );
}
