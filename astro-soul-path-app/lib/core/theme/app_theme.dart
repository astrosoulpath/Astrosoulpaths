import 'package:flutter/material.dart';

abstract final class AppColors {
  static const Color background = Color(0xFF000000);
  static const Color surface = Color(0xFF121212);
  static const Color surfaceLight = Color(0xFF1C1C1C);

  static const Color lightBackground = Color(0xFF000000);
  static const Color lightSurface = Color(0xFF121212);

  static const Color gold = Color(0xFFFFD21F);
  static const Color goldDark = Color(0xFFE0B800);
  static const Color white = Color(0xFFF5F5F5);
  static const Color muted = Color(0xFFB4B4B4);

  static const Color border = Color(0xFF3A3A3A);
  static const Color divider = Color(0xFF4A4A4A);
}

abstract final class AppTheme {
  static ThemeData get dark {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.gold,
          brightness: Brightness.dark,
          surface: AppColors.surface,
        ).copyWith(
          primary: AppColors.gold,
          secondary: AppColors.gold,
          surface: AppColors.surface,
          onSurface: AppColors.white,
          onPrimary: AppColors.background,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.background,
      colorScheme: scheme,
      fontFamily: 'Roboto',
      dividerColor: AppColors.divider,
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        elevation: 0,
      ),
      cardTheme: const CardThemeData(color: AppColors.surface, elevation: 0),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          color: AppColors.white,
          fontSize: 30,
          fontWeight: FontWeight.w800,
          height: 1.15,
        ),
        titleMedium: TextStyle(
          color: AppColors.white,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
        bodyMedium: TextStyle(
          color: AppColors.muted,
          fontSize: 14,
          height: 1.5,
        ),
      ),
    );
  }

  static ThemeData get light {
    final scheme =
        ColorScheme.fromSeed(
          seedColor: AppColors.gold,
          brightness: Brightness.light,
          surface: Colors.white,
        ).copyWith(
          primary: AppColors.gold,
          secondary: AppColors.gold,
          surface: Colors.white,
          onSurface: Colors.black,
          onPrimary: Colors.black,
        );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: Colors.white,
      colorScheme: scheme,
      fontFamily: 'Roboto',
      dividerColor: const Color(0xFFE0E0E0),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
      ),
      cardTheme: const CardThemeData(color: Colors.white, elevation: 0),
      dialogTheme: const DialogThemeData(backgroundColor: Colors.white),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: Colors.white,
        modalBackgroundColor: Colors.white,
      ),
      textTheme: const TextTheme(
        headlineMedium: TextStyle(
          color: Colors.black,
          fontSize: 30,
          fontWeight: FontWeight.w800,
          height: 1.15,
        ),
        titleMedium: TextStyle(
          color: Colors.black,
          fontSize: 17,
          fontWeight: FontWeight.w700,
        ),
        bodyMedium: TextStyle(
          color: Color(0xFF555555),
          fontSize: 14,
          height: 1.5,
        ),
      ),
      iconTheme: const IconThemeData(color: Colors.black),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color?>((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.gold;
          }
          return Colors.black54;
        }),
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith<Color?>((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.gold;
          }
          return Colors.transparent;
        }),
        checkColor: const WidgetStatePropertyAll<Color>(Colors.black),
      ),
    );
  }
}
