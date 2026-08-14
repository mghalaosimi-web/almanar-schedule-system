/// أسماء صناديق Hive المستخدمة في التطبيق
/// مركزية لتجنب الأخطاء الإملائية
class HiveBoxes {
  HiveBoxes._();

  /// جداول الدروس المخزنة محلياً
  static const String schedules = 'schedules_box';

  /// بيانات المستخدم الحالي
  static const String currentUser = 'current_user_box';

  /// التعديلات الاستثنائية على الجدول
  static const String overrides = 'overrides_box';

  /// إعدادات التطبيق
  static const String settings = 'settings_box';

  /// سجل الحضور (للمندوب)
  static const String attendance = 'attendance_box';

  /// طابور المزامنة التلقائي عند التواجد أوفلاين
  static const String syncQueue = 'sync_queue_box';
}

/// Type IDs لـ Hive Adapters
/// يجب أن يكون كل typeId فريداً في التطبيق
class HiveTypeIds {
  HiveTypeIds._();

  static const int scheduleEntry = 0;
  static const int userModel     = 1;
  static const int overrideEntry = 2;
}
