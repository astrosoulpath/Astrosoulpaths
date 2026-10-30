import 'package:flutter/material.dart';

abstract final class AppColors {
  // Premium Astro Soul Path palette
  static const Color background = Color(0xFFFFF9F1);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceLight = Color(0xFFF8F3FF);

  static const Color lightBackground = Color(0xFFFFF9F1);
  static const Color lightSurface = Color(0xFFFFFFFF);

  static const Color navy = Color(0xFF17213B);
  static const Color purple = Color(0xFF7548CF);
  static const Color purpleSoft = Color(0xFFF0E9FF);

  static const Color gold = Color(0xFFF5C542);
  static const Color goldDark = Color(0xFFD7A91D);
  static const Color goldSoft = Color(0xFFFFF3C4);

  // Kept names for compatibility with existing screens.
  static const Color white = Color(0xFF17213B);
  static const Color muted = Color(0xFF6F7280);

  static const Color border = Color(0xFFE8E2F0);
  static const Color divider = Color(0xFFEDE7F3);
}

/// Context-based semantic tokens for customer surfaces and custom artwork.
extension CustomerTheme on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
  Color get pageColor => Theme.of(this).scaffoldBackgroundColor;
  Color get inkColor => colors.onSurface;
  Color get mutedColor => colors.onSurfaceVariant;
  Color get cardColor => colors.surface;
  Color get borderColor => colors.outline;
  bool get darkAppearance => Theme.of(this).brightness == Brightness.dark;
}

abstract final class AppTheme {
  static ThemeData _premiumTheme(Brightness brightness) {
    final dark = brightness == Brightness.dark;
    final background = dark ? const Color(0xFF080D20) : AppColors.background;
    final surface = dark ? const Color(0xFF151B35) : AppColors.surface;
    final elevated = dark ? const Color(0xFF202747) : AppColors.surfaceLight;
    final ink = dark ? const Color(0xFFF8F5FF) : const Color(0xFF17213B);
    final muted = dark ? const Color(0xFFBFC5DB) : const Color(0xFF596174);
    final primary = dark ? const Color(0xFF9569F0) : const Color(0xFF7548CF);
    final border = dark ? const Color(0xFF343C60) : const Color(0xFFE8E2F0);
    final scheme =
        ColorScheme.fromSeed(
          seedColor: primary,
          brightness: brightness,
        ).copyWith(
          primary: primary,
          onPrimary: dark ? const Color(0xFF080D20) : Colors.white,
          secondary: const Color(0xFFF5C542),
          onSecondary: const Color(0xFF17213B),
          surface: surface,
          surfaceContainer: elevated,
          surfaceContainerHighest: elevated,
          onSurface: ink,
          onSurfaceVariant: muted,
          outline: border,
          outlineVariant: border,
        );
    final base = ThemeData(
      useMaterial3: true,
      brightness: brightness,
      colorScheme: scheme,
      fontFamily: 'Roboto',
      scaffoldBackgroundColor: background,
    );
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(20),
      side: BorderSide(color: border),
    );
    return base.copyWith(
      textTheme: base.textTheme.apply(bodyColor: ink, displayColor: ink),
      dividerColor: border,
      iconTheme: IconThemeData(color: ink),
      appBarTheme: AppBarTheme(
        backgroundColor: background,
        foregroundColor: ink,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: shape,
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: surface,
        modalBackgroundColor: surface,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: elevated,
        elevation: 0,
        height: 68,
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(WidgetState.selected) ? primary : muted,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected) ? primary : muted,
          ),
        ),
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: surface,
        selectedItemColor: primary,
        unselectedItemColor: muted,
        type: BottomNavigationBarType.fixed,
      ),
      drawerTheme: DrawerThemeData(backgroundColor: surface),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(48, 50),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: scheme.onPrimary,
          minimumSize: const Size(48, 50),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primary,
          side: BorderSide(color: border),
          minimumSize: const Size(48, 48),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        hintStyle: TextStyle(color: muted),
        labelStyle: TextStyle(color: muted),
        prefixIconColor: primary,
        suffixIconColor: muted,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 15,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: primary, width: 1.5),
        ),
      ),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: surface,
        selectedColor: elevated,
        side: BorderSide(color: border),
        labelStyle: TextStyle(color: ink),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: primary),
      dividerTheme: DividerThemeData(color: border),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: elevated,
        contentTextStyle: TextStyle(color: ink),
      ),
    );
  }

  static ThemeData get light => _premiumTheme(Brightness.light);
  static ThemeData get dark => _premiumTheme(Brightness.dark);
}
