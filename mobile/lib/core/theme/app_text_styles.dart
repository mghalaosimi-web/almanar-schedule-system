import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'app_colors.dart';

class AppTextStyles {
  AppTextStyles._();

  // ── Display ─────────────────────────────────────────────────────
  static TextStyle get displayLarge => GoogleFonts.cairo(
    fontSize: 32, fontWeight: FontWeight.w800, color: AppColors.textPrimary,
    letterSpacing: -0.5,
  );

  static TextStyle get displayMedium => GoogleFonts.cairo(
    fontSize: 26, fontWeight: FontWeight.w700, color: AppColors.textPrimary,
  );

  // ── Headlines ───────────────────────────────────────────────────
  static TextStyle get headlineLarge => GoogleFonts.cairo(
    fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textPrimary,
  );

  static TextStyle get headlineMedium => GoogleFonts.cairo(
    fontSize: 18, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
  );

  static TextStyle get headlineSmall => GoogleFonts.cairo(
    fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
  );

  // ── Body ────────────────────────────────────────────────────────
  static TextStyle get bodyLarge => GoogleFonts.cairo(
    fontSize: 15, fontWeight: FontWeight.w400, color: AppColors.textPrimary,
  );

  static TextStyle get bodyMedium => GoogleFonts.cairo(
    fontSize: 13, fontWeight: FontWeight.w400, color: AppColors.textSecondary,
  );

  static TextStyle get bodySmall => GoogleFonts.cairo(
    fontSize: 11, fontWeight: FontWeight.w400, color: AppColors.textMuted,
  );

  // ── Labels ──────────────────────────────────────────────────────
  static TextStyle get labelLarge => GoogleFonts.cairo(
    fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary,
  );

  static TextStyle get labelMedium => GoogleFonts.cairo(
    fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary,
    letterSpacing: 0.5,
  );

  static TextStyle get labelSmall => GoogleFonts.cairo(
    fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.textMuted,
    letterSpacing: 0.5,
  );

  // ── Accent ──────────────────────────────────────────────────────
  static TextStyle get accentLabel => GoogleFonts.cairo(
    fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.accent,
    letterSpacing: 0.5,
  );

  static TextStyle get accentHeadline => GoogleFonts.cairo(
    fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.accent,
  );

  // ── Input ───────────────────────────────────────────────────────
  static TextStyle get inputText => GoogleFonts.cairo(
    fontSize: 14, fontWeight: FontWeight.w500, color: AppColors.textPrimary,
  );

  static TextStyle get inputHint => GoogleFonts.cairo(
    fontSize: 14, fontWeight: FontWeight.w400, color: AppColors.textMuted,
  );
}
