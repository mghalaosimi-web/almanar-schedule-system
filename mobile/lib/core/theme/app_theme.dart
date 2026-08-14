import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTheme {
  AppTheme._();

  // ── Dark Theme (Deep Navy & Academic Blue) ──────────────────────
  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: AppColors.darkBg,
    primaryColor: AppColors.accent,

    colorScheme: const ColorScheme.dark(
      primary: AppColors.accent,
      primaryContainer: AppColors.accentSubtle,
      secondary: AppColors.gold,
      surface: AppColors.darkCard,
      error: AppColors.error,
      onPrimary: Colors.white,
      onSurface: AppColors.textPrimaryDark,
    ),

    textTheme: GoogleFonts.cairoTextTheme(ThemeData.dark().textTheme).copyWith(
      displayLarge: GoogleFonts.cairo(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w800),
      headlineMedium: GoogleFonts.cairo(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w700),
      bodyLarge: GoogleFonts.cairo(color: AppColors.textPrimaryDark),
      bodyMedium: GoogleFonts.cairo(color: AppColors.textSecondaryDark),
    ),

    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.darkCard,
      elevation: 0,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.light.copyWith(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
      ),
      titleTextStyle: GoogleFonts.cairo(
        fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimaryDark,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimaryDark),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.darkSurface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x1FFFFFFF)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x1FFFFFFF)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      hintStyle: GoogleFonts.cairo(color: AppColors.textMutedDark, fontSize: 14),
      labelStyle: GoogleFonts.cairo(color: AppColors.textSecondaryDark, fontSize: 14),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accent,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),

    cardTheme: CardThemeData(
      color: AppColors.darkCard,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: Color(0x1FFFFFFF)),
      ),
    ),

    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: AppColors.darkCard,
      selectedItemColor: AppColors.accent,
      unselectedItemColor: AppColors.textMutedDark,
      elevation: 0,
      type: BottomNavigationBarType.fixed,
      selectedLabelStyle: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: GoogleFonts.cairo(fontSize: 11),
    ),

    dividerTheme: const DividerThemeData(color: Color(0x1FFFFFFF), thickness: 1),
    iconTheme: const IconThemeData(color: AppColors.textSecondaryDark, size: 22),
  );

  // ── Light Theme (Day Mode / Slate & Royal Blue) ────────────────
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: AppColors.lightBg,
    primaryColor: AppColors.accentDark,

    colorScheme: const ColorScheme.light(
      primary: AppColors.accentDark,
      primaryContainer: AppColors.accentSubtle,
      secondary: AppColors.gold,
      surface: AppColors.lightCard,
      error: AppColors.error,
      onPrimary: Colors.white,
      onSurface: AppColors.textPrimaryLight,
    ),

    textTheme: GoogleFonts.cairoTextTheme(ThemeData.light().textTheme).copyWith(
      displayLarge: GoogleFonts.cairo(color: AppColors.textPrimaryLight, fontWeight: FontWeight.w800),
      headlineMedium: GoogleFonts.cairo(color: AppColors.textPrimaryLight, fontWeight: FontWeight.w700),
      bodyLarge: GoogleFonts.cairo(color: AppColors.textPrimaryLight),
      bodyMedium: GoogleFonts.cairo(color: AppColors.textSecondaryLight),
    ),

    appBarTheme: AppBarTheme(
      backgroundColor: AppColors.lightCard,
      elevation: 0.5,
      centerTitle: false,
      systemOverlayStyle: SystemUiOverlayStyle.dark.copyWith(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.dark,
      ),
      titleTextStyle: GoogleFonts.cairo(
        fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.textPrimaryLight,
      ),
      iconTheme: const IconThemeData(color: AppColors.textPrimaryLight),
    ),

    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.lightSurface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.lightBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.lightBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.accentDark, width: 1.5),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.error),
      ),
      hintStyle: GoogleFonts.cairo(color: AppColors.textMutedLight, fontSize: 14),
      labelStyle: GoogleFonts.cairo(color: AppColors.textSecondaryLight, fontSize: 14),
    ),

    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.accentDark,
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: const Size(double.infinity, 56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: GoogleFonts.cairo(fontSize: 15, fontWeight: FontWeight.w700),
      ),
    ),

    cardTheme: CardThemeData(
      color: AppColors.lightCard,
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: const BorderSide(color: AppColors.lightBorder),
      ),
    ),

    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: AppColors.lightCard,
      selectedItemColor: AppColors.accentDark,
      unselectedItemColor: AppColors.textMutedLight,
      elevation: 4,
      type: BottomNavigationBarType.fixed,
      selectedLabelStyle: GoogleFonts.cairo(fontSize: 11, fontWeight: FontWeight.w600),
      unselectedLabelStyle: GoogleFonts.cairo(fontSize: 11),
    ),

    dividerTheme: const DividerThemeData(color: AppColors.lightBorder, thickness: 1),
    iconTheme: const IconThemeData(color: AppColors.textSecondaryLight, size: 22),
  );
}
