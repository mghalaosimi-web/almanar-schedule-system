import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import '../../../data/local/schedule_cache_dao.dart';
import '../../../data/remote/api_client.dart';
import '../../../core/constants/api_endpoints.dart';
import '../models/schedule_entry.dart';

/// نتيجة تحميل الجداول مع معلومات المصدر
class ScheduleResult {
  final List<ScheduleEntry> entries;
  final bool isFromCache;
  final bool isCacheStale;
  final DateTime? cachedAt;
  final String? error;

  const ScheduleResult({
    required this.entries,
    this.isFromCache = false,
    this.isCacheStale = false,
    this.cachedAt,
    this.error,
  });

  bool get hasData => entries.isNotEmpty;
}

/// خدمة الجداول — تُطبّق استراتيجية Cache-then-Network
class ScheduleService extends ChangeNotifier {
  ScheduleService._internal();
  static final ScheduleService _instance = ScheduleService._internal();
  factory ScheduleService() => _instance;

  final _dao = ScheduleCacheDao.instance;
  final _api = ApiClient();

  bool _isSyncing = false;
  bool get isSyncing => _isSyncing;

  /// ── الاستراتيجية الرئيسية: Cache-then-Network ──────────────────
  ///
  /// 1. يُعيد الكاش المحلي فوراً إذا وُجد
  /// 2. يُحدّث من السيرفر في الخلفية إذا كان الاتصال متاحاً
  /// 3. يُعيد نتيجة مع علامة [isFromCache] لإظهار الشارة المناسبة
  Future<ScheduleResult> getSchedule({
    required bool isConnected,
    String? major,
    String? level,
    String? group,
    bool isMySchedule = true, // true = /schedules/my
  }) async {
    final cacheKey = _buildCacheKey(major, level, group, isMySchedule);

    // ── Step 1: هل يوجد كاش؟ ────────────────────────────────────
    final cached = _dao.getAll();
    final hasCache = cached.isNotEmpty;

    if (!isConnected) {
      // لا إنترنت — أعد الكاش مع علامة تحذير إذا قديم
      return ScheduleResult(
        entries: cached,
        isFromCache: true,
        isCacheStale: _dao.isCacheStale(),
        cachedAt: _dao.lastUpdated(),
        error: hasCache ? null : 'لا توجد بيانات محفوظة',
      );
    }

    // ── Step 2: مع إنترنت — أعد الكاش أولاً ──────────────────────
    if (hasCache) {
      // شغّل التحديث في الخلفية
      _syncInBackground(cacheKey: cacheKey, major: major, level: level, group: group, isMySchedule: isMySchedule);
      return ScheduleResult(
        entries: cached,
        isFromCache: true,
        isCacheStale: _dao.isCacheStale(),
        cachedAt: _dao.lastUpdated(),
      );
    }

    // ── Step 3: لا يوجد كاش — اجلب من السيرفر مباشرة ─────────────
    return await _fetchFromServer(
      cacheKey: cacheKey,
      major: major,
      level: level,
      group: group,
      isMySchedule: isMySchedule,
    );
  }

  /// تحديث في الخلفية (لا يوقف الـ UI)
  void _syncInBackground({
    required String cacheKey,
    String? major,
    String? level,
    String? group,
    bool isMySchedule = true,
  }) {
    if (_isSyncing) return;
    _fetchFromServer(
      cacheKey: cacheKey,
      major: major,
      level: level,
      group: group,
      isMySchedule: isMySchedule,
    ).then((_) {
      notifyListeners(); // يُبلّغ الـ UI بالتحديث
    });
  }

  Future<ScheduleResult> _fetchFromServer({
    required String cacheKey,
    String? major,
    String? level,
    String? group,
    bool isMySchedule = true,
  }) async {
    _isSyncing = true;
    notifyListeners();

    try {
      Response response;

      try {
        if (isMySchedule) {
          response = await _api.get(ApiEndpoints.mySchedule);
        } else {
          response = await _api.get(
            ApiEndpoints.groupSchedule,
            queryParameters: {
              'major': major,
              'level': level,
              'group': group,
            }..removeWhere((_, v) => v == null),
          );
        }
      } catch (err) {
        response = await _api.get('/public/schedules', queryParameters: {'collegeId': 1});
      }

      final raw = response.data;
      List<dynamic> list = [];

      if (raw is List) {
        list = raw;
      } else if (raw is Map) {
        list = raw['schedules'] as List<dynamic>? ??
               raw['data'] as List<dynamic>? ?? [];
      }

      final entries = list
          .map((j) => ScheduleEntry.fromJson(j as Map<String, dynamic>))
          .toList();

      // حفظ في Hive
      await _dao.saveSchedules(cacheKey, entries);

      return ScheduleResult(entries: entries, isFromCache: false, cachedAt: DateTime.now());
    } on DioException catch (e) {
      debugPrint('[ScheduleService] Fetch error: ${e.message}');
      // إذا فشل الجلب، أعد الكاش إذا وُجد
      final fallback = _dao.getAll();
      return ScheduleResult(
        entries: fallback,
        isFromCache: true,
        isCacheStale: true,
        cachedAt: _dao.lastUpdated(),
        error: 'تعذر التحديث: ${_parseError(e)}',
      );
    } finally {
      _isSyncing = false;
      notifyListeners();
    }
  }

  /// جلب التعديلات الاستثنائية
  Future<List<Map<String, dynamic>>> getOverrides({String? date}) async {
    try {
      final response = await _api.get(
        ApiEndpoints.overrides,
        queryParameters: {if (date != null) 'date': date},
      );
      final raw = response.data;
      if (raw is List) return raw.cast<Map<String, dynamic>>();
      return [];
    } catch (_) {
      return [];
    }
  }

  String _buildCacheKey(String? major, String? level, String? group, bool isMy) {
    if (isMy) return 'my_schedule';
    return '${major ?? ''}_${level ?? ''}_${group ?? ''}';
  }

  String _parseError(DioException e) {
    if (e.type == DioExceptionType.connectionError) return 'لا يوجد اتصال';
    if (e.type == DioExceptionType.connectionTimeout) return 'انتهت المهلة';
    return e.response?.statusCode?.toString() ?? 'خطأ غير معروف';
  }
}
