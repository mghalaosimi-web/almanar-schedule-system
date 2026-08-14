import 'package:hive_flutter/hive_flutter.dart';
import '../../features/schedule/models/schedule_entry.dart';
import 'hive_boxes.dart';

/// Data Access Object للجداول المحلية
/// يُجرّد كل عمليات CRUD على Hive
class ScheduleCacheDao {
  ScheduleCacheDao._();
  static final ScheduleCacheDao instance = ScheduleCacheDao._();

  Box<ScheduleEntry>? _box;

  Box<ScheduleEntry> get _scheduleBox {
    if (_box == null || !_box!.isOpen) {
      _box = Hive.box<ScheduleEntry>(HiveBoxes.schedules);
    }
    return _box!;
  }

  // ── Write ─────────────────────────────────────────────────────────

  /// يحفظ قائمة حصص، يُحذف القديم بنفس المفتاح أولاً
  Future<void> saveSchedules(
    String cacheKey,
    List<ScheduleEntry> entries,
  ) async {
    final box = _scheduleBox;
    // حذف الإدخالات القديمة لنفس المفتاح
    final oldKeys = box.keys
        .where((k) => k.toString().startsWith('${cacheKey}_'))
        .toList();
    await box.deleteAll(oldKeys);

    // حفظ الجديدة
    final Map<String, ScheduleEntry> toSave = {};
    for (int i = 0; i < entries.length; i++) {
      toSave['${cacheKey}_$i'] = entries[i];
    }
    await box.putAll(toSave);
  }

  // ── Read ──────────────────────────────────────────────────────────

  /// استرجاع جداول يوم بعينه
  List<ScheduleEntry> getByDay(String cacheKey, String day) {
    return _scheduleBox.values
        .where((e) =>
            e.day.toUpperCase() == day.toUpperCase())
        .toList()
      ..sort((a, b) => a.timeStart.compareTo(b.timeStart));
  }

  /// استرجاع كل الجداول المخزنة
  List<ScheduleEntry> getAll() {
    return _scheduleBox.values.toList();
  }

  /// هل يوجد أي كاش محفوظ؟
  bool hasCachedData() => _scheduleBox.isNotEmpty;

  /// هل الكاش قديم (الأول منه إذا وُجد)؟
  bool isCacheStale() {
    if (_scheduleBox.isEmpty) return true;
    return _scheduleBox.values.first.isStale;
  }

  /// تاريخ آخر تحديث
  DateTime? lastUpdated() {
    if (_scheduleBox.isEmpty) return null;
    return _scheduleBox.values.first.cachedAt;
  }

  // ── Delete ────────────────────────────────────────────────────────

  Future<void> clearAll() async {
    await _scheduleBox.clear();
  }
}
