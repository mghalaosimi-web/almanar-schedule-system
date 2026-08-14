class AppStrings {
  AppStrings._();

  // ── App ──────────────────────────────────────────────────────────
  static const String appName        = 'نظام جداول المنار';
  static const String appTagline     = 'كلية المنار الجامعية';
  static const String appVersion     = 'الإصدار 2.0';

  // ── Auth ─────────────────────────────────────────────────────────
  static const String login          = 'تسجيل الدخول';
  static const String logout         = 'تسجيل الخروج';
  static const String email          = 'البريد الإلكتروني';
  static const String studentId      = 'رقم الطالب الجامعي';
  static const String password       = 'كلمة المرور';
  static const String loginButton    = 'دخول';
  static const String loggingIn      = 'جاري الدخول...';
  static const String loginError     = 'خطأ في البيانات، تأكد من رقمك وكلمة المرور';
  static const String offlineLogin   = 'دخول بدون إنترنت (بيانات محفوظة)';

  // ── Roles ────────────────────────────────────────────────────────
  static const String roleStudent        = 'طالب';
  static const String roleRepresentative = 'مندوب';
  static const String roleLecturer       = 'محاضر';

  // ── Navigation ───────────────────────────────────────────────────
  static const String navHome        = 'الرئيسية';
  static const String navSchedule    = 'الجدول';
  static const String navAttendance  = 'الحضور';
  static const String navBroadcast   = 'إشعارات';
  static const String navProfile     = 'حسابي';

  // ── Schedule ─────────────────────────────────────────────────────
  static const String schedule        = 'الجدول الدراسي';
  static const String noSchedule      = 'لا توجد محاضرات لهذا اليوم';
  static const String noScheduleHint  = 'استمتع بيومك! 🎓';
  static const String overrideNotice  = 'تعديل استثنائي';
  static const String room            = 'القاعة';
  static const String lecturer        = 'المحاضر';
  static const String loadingSchedule = 'جاري تحميل الجدول...';
  static const String syncingSchedule = 'جاري تحديث الجدول...';
  static const String scheduleUpdated = 'تم تحديث الجدول ✓';

  // ── Days ─────────────────────────────────────────────────────────
  static const Map<String, String> days = {
    'SATURDAY'  : 'السبت',
    'SUNDAY'    : 'الأحد',
    'MONDAY'    : 'الاثنين',
    'TUESDAY'   : 'الثلاثاء',
    'WEDNESDAY' : 'الأربعاء',
    'THURSDAY'  : 'الخميس',
  };

  // ── Status ───────────────────────────────────────────────────────
  static const String online         = 'متصل بالإنترنت';
  static const String offline        = 'غير متصل — عرض البيانات المحفوظة';
  static const String cacheStale     = 'قد تكون البيانات قديمة، تحقق من الاتصال';
  static const String cachedAt       = 'آخر تحديث';
  static const String retrying       = 'إعادة المحاولة...';

  // ── Errors ───────────────────────────────────────────────────────
  static const String networkError   = 'لا يوجد اتصال بالإنترنت';
  static const String serverError    = 'خطأ في السيرفر، حاول مجدداً';
  static const String noCacheError   = 'لا توجد بيانات محفوظة. اتصل بالإنترنت أولاً';
  static const String unknownError   = 'حدث خطأ غير متوقع';

  // ── Representative ───────────────────────────────────────────────
  static const String attendance       = 'تسجيل الحضور';
  static const String markPresent      = 'حاضر';
  static const String markAbsent       = 'غائب';
  static const String submitAttendance = 'رفع كشف الحضور';
  static const String broadcastTitle   = 'إشعار للمجموعة';
  static const String broadcastHint    = 'اكتب رسالتك هنا...';
  static const String sendBroadcast    = 'إرسال الإشعار';

  // ── Signature ────────────────────────────────────────────────────
  static const String devSignature   = 'M.GH.AL — MANAR SYS';
}
