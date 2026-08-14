import 'package:flutter/material.dart';

/// لوحة الألوان الرسمية لتطبيق كلية المنار الجامعية (دعم وضع النهار والليل)
class AppColors {
  AppColors._();

  // ── Dark Mode Colors ─────────────────────────────────────────────
  static const Color darkBg        = Color(0xFF0A0F1D); // Deep Navy background
  static const Color darkCard      = Color(0xFF0E1626); // Dark surface card
  static const Color darkSurface   = Color(0xFF141D2F); // Elevated surface

  // ── Light Mode Colors (Day Mode) ──────────────────────────────────
  static const Color lightBg       = Color(0xFFF8FAFC); // Clean Off-White
  static const Color lightCard     = Color(0xFFFFFFFF); // White Surface Card
  static const Color lightSurface  = Color(0xFFF1F5F9); // Light Slate Surface
  static const Color lightBorder   = Color(0xFFE2E8F0); // Light Border

  // ── Primary Accent (Academic Blue) ──────────────────────────────
  static const Color accent        = Color(0xFF3B82F6); // Academic Blue primary
  static const Color accentLight   = Color(0xFF60A5FA); // Sky Blue light
  static const Color accentDark    = Color(0xFF0284C7); // Royal Blue
  static const Color accentGlow    = Color(0x333B82F6); // Soft blue glow 20%
  static const Color accentSubtle  = Color(0x1A3B82F6); // Subtle blue background 10%

  // ── Secondary Accent (Academic Gold / Amber) ────────────────────
  static const Color gold          = Color(0xFFF59E0B); // Amber Gold
  static const Color goldLight     = Color(0xFFFBBF24); // Light Gold
  static const Color goldSubtle    = Color(0x1AF59E0B); // Gold background 10%

  // ── Text Colors ────────────────────────────────────────────────
  static const Color textPrimaryDark   = Color(0xFFFFFFFF);
  static const Color textSecondaryDark = Color(0x99FFFFFF); // 60%
  static const Color textMutedDark     = Color(0x59FFFFFF); // 35%

  static const Color textPrimaryLight   = Color(0xFF0F172A); // Dark Slate Text
  static const Color textSecondaryLight = Color(0xFF475569); // Medium Slate
  static const Color textMutedLight     = Color(0xFF94A3B8); // Muted Slate

  // ── Defaults for backwards compatibility ────────────────────────
  static const Color cardBg        = Color(0xFF0E1626);
  static const Color textPrimary   = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0x99FFFFFF);
  static const Color textMuted     = Color(0x59FFFFFF);
  static const Color glassBorder   = Color(0x1FFFFFFF);

  // ── Status Colors ───────────────────────────────────────────────
  static const Color success       = Color(0xFF10B981); // Emerald Green
  static const Color warning       = Color(0xFFF59E0B); // Amber Warning
  static const Color error         = Color(0xFFEF4444); // Crimson Red
  static const Color info          = Color(0xFF38BDF8); // Sky Blue Info
  static const Color offline       = Color(0xFF6B7280); // Slate Gray

  // ── Gradients ───────────────────────────────────────────────────
  static const LinearGradient accentGradient = LinearGradient(
    colors: [Color(0xFF2563EB), Color(0xFF3B82F6)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient goldGradient = LinearGradient(
    colors: [Color(0xFFD97706), Color(0xFFF59E0B)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  // ── Roles ────────────────────────────────────────────────────────
  static const Color studentColor        = Color(0xFF3B82F6); // Academic Blue
  static const Color representativeColor = Color(0xFFF59E0B); // Academic Gold
  static const Color lecturerColor       = Color(0xFF10B981); // Emerald Green
}
