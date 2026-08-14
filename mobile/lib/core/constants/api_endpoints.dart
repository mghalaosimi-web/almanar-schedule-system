import 'package:flutter/foundation.dart';

/// نقاط نهاية API السيرفر (Node/Express)
class ApiEndpoints {
  ApiEndpoints._();

  // ── Base URL ─────────────────────────────────────────────────────
  /// يتحدد تلقائياً حسب المنصة البيئة (Web / Android Emulator / Prod)
  static String get baseUrl {
    const overrideUrl = String.fromEnvironment('API_BASE_URL', defaultValue: '');
    if (overrideUrl.isNotEmpty) return overrideUrl;

    if (kReleaseMode) {
      return 'https://almanar-schedule-system.onrender.com/api';
    }

    if (kIsWeb) {
      return 'http://localhost:5001/api';
    }

    // افتراضي لنظام أندرويد emulator مع دعم السيرفر المحلي
    return 'http://10.0.2.2:5001/api';
  }

  // ── Auth ─────────────────────────────────────────────────────────
  static const String login    = '/auth/login';
  static const String register = '/auth/register';
  static const String logout   = '/auth/logout';
  static const String profile  = '/user/profile';
  static const String forgotPassword = '/auth/forgot-password';
  static const String requestCredentials = '/auth/request-credentials';

  // ── Schedules ────────────────────────────────────────────────────
  static const String mySchedule    = '/schedules/my';
  static const String groupSchedule = '/schedules';

  // ── Overrides (التعديلات الاستثنائية) ───────────────────────────
  static const String overrides = '/overrides';

  // ── Representative ───────────────────────────────────────────────
  static const String classmates      = '/rep/classmates';
  static const String attendance      = '/rep/attendance';
  static const String broadcast       = '/rep/broadcast';
  static const String broadcasts      = '/rep/broadcasts';
  static const String overrideRequest = '/overrides/request';

  // ── Helpers ──────────────────────────────────────────────────────
  static String full(String path) => '$baseUrl$path';
}
