# 🔌 FLUTTER P0 INTEGRATION REPORT — REAL BACKEND CONNECTIVITY

**التاريخ:** 15 أغسطس 2026  
**الصفة:** EXECUTIVE TECHNICAL LEAD  
**المشروع:** تطبيق جداول كلية المنار الجامعية (`manar_schedule`)  
**المسار:** `F:\almanar-college-system\mobile`

---

## 1. Attendance Integration | ربط كشف الحضور والغياب

- **الشاشة:** `lib/features/representative/screens/attendance_screen.dart`
- **الحالة السابقة:** كانت تنشئ 12 طالب وهمي في الذاكرة مع إرسال محاكى بـ `Future.delayed(2s)`.
- **الحالة الحالية (`CONNECTED`):**
  - عند فتح الشاشة: يتم جلب قائمة الطلاب الحقيقيين لشعبة المندوب من السيرفر عبر `GET /api/rep/classmates`.
  - عند الإرسال: يتم تحويل رغبات الحضور/الغياب إلى الهيكل المطلوب وإرسالها للسيرفر عبر `POST /api/rep/attendance`.
  - يتم إطلاق إشعار محلي فور نجاح الرفع بالسيرفر.

---

## 2. Attendance API Contract | عقد API كشف الحضور

```http
GET /api/rep/classmates
Header: Authorization: Bearer <jwt_token>
Response:
{
  "success": true,
  "data": [
    { "id": 101, "name": "أحمد محمد الزيدي", "idNumber": "2026-1001" },
    { "id": 102, "name": "فاطمة علي الحمود", "idNumber": "2026-1002" }
  ]
}

POST /api/rep/attendance
Header: Authorization: Bearer <jwt_token>
Body:
{
  "scheduleId": 1,
  "date": "2026-08-15T00:00:00.000Z",
  "records": [
    { "studentId": 101, "status": "PRESENT" },
    { "studentId": 102, "status": "ABSENT" }
  ]
}
Response:
{
  "success": true,
  "message": "Attendance sheet saved successfully."
}
```

---

## 3. Attendance Result | النتيجة والمطابقة

- **حالة التحميل:** تعرض مؤشر تحميل أنيق وإعادة المحاولة في حال تعذر الشبكة.
- **حالة الحظر:** إذا حاول غير المندوب الفتح، يعيد السيرفر كود 403 وتظهر الشاشة رسالة عدم تصريح مناسبة.
- **المعالجة الحقيقية:** تم التخلص التام من قائمة الـ 12 طالب الوهمية وتأخير الـ 2 ثواني.

---

## 4. Broadcast Integration | ربط البث الجماعي للمندوب

- **الشاشة:** `lib/features/representative/screens/broadcast_screen.dart`
- **الحالة السابقة:** كانت تعتمد على سجل وهمي ثابت في الذاكرة وإرسال محاكى بـ `Future.delayed(2s)`.
- **الحالة الحالية (`CONNECTED`):**
  - عند الفتح: يتم جلب سجل الإشعارات السابقة المرسلة للمجموعة من السيرفر عبر `GET /api/rep/broadcasts`.
  - عند الإرسال: يتم إرسال نص التنبيه عبر `POST /api/rep/broadcast`.
  - يتم إظهار التنبيه المحلي وتحديث السجل المعروض فوراً.

---

## 5. Broadcast API Contract | عقد API البث الجماعي

```http
GET /api/rep/broadcasts
Header: Authorization: Bearer <jwt_token>
Response:
{
  "success": true,
  "data": [
    {
      "broadcastId": "uuid-123",
      "message": "تم تأجيل المحاضرة القادمة إلى قاعة 5",
      "sentTime": "2026-08-15T00:00:00.000Z",
      "recipients": []
    }
  ]
}

POST /api/rep/broadcast
Header: Authorization: Bearer <jwt_token>
Body:
{
  "message": "تذكير: الاختبار النصفي الأسبوع القادم في معمل الحاسوب"
}
Response:
{
  "success": true,
  "data": { ... }
}
```

---

## 6. Broadcast Result | النتيجة والمطابقة

- **السجل:** يعرض السجل الحقيقي للتنبيهات الصادرة من المندوب بتنسيق التاريخ والوقت المحلي.
- **التحقق:** التخلص التام من التأخير الوهمي `Future.delayed(2s)` وإصدار إشعار محلي حقيقي عند الإرسال.

---

## 7. Registration Integration | ربط طلب الانضمام والتسجيل

- **الشاشة:** `lib/features/auth/screens/register_screen.dart`
- **الحالة السابقة:** كانت تعتمد على تأخير محاكى `Future.delayed(2s)` ثم توجيه للمنصة.
- **الحالة الحالية (`CONNECTED`):**
  - عند الضغط على إرسال: يتم فحص الاسم الثلاثي محلياً ثم إرسال البيانات للسيرفر عبر `POST /api/auth/register`.
  - يتم حفظ توكن الجلسة في `FlutterSecureStorage` وإظهار رسالة النجاح والتوجيه إلى تسجيل الدخول.

---

## 8. Registration API Contract | عقد API التسجيل

```http
POST /api/auth/register
Body:
{
  "fullName": "أحمد محمد علي الزيدي",
  "email": "student@almanar.edu.ye",
  "password": "password123",
  "phone": "+967770000000",
  "idNumber": "2026-TEST01",
  "majorId": "هندسة البرمجيات",
  "levelId": "1",
  "collegeId": 1
}
Response:
{
  "success": true,
  "message": "Student registered and logged in successfully.",
  "token": "eyJhbGciOi...",
  "user": { "id": 1, "name": "أحمد محمد علي الزيدي", "role": "STUDENT" }
}
```

---

## 9. Registration Result | النتيجة والمطابقة

- **معالجة الأخطاء:** في حال تكرار البريد أو الهاتف أو الرقم الجامعي، يعرض التطبيق الرسالة الصريحة القادمة من السيرفر (مثل: `Email address is already registered`).
- **المعالجة الحقيقية:** تم التخلص التام من المحاكاة.

---

## 10. Files Changed | الملفات المعدلة في هذه المرحلة

1. `mobile/lib/core/constants/api_endpoints.dart`: إضافة ثوابت الـ Endpoints الخاصة بمندوب الدفعة (`/rep/classmates`, `/rep/attendance`, `/rep/broadcast`, `/rep/broadcasts`).
2. `mobile/lib/features/representative/screens/attendance_screen.dart`: الربط البرمجي الشامل لكشف الحضور.
3. `mobile/lib/features/representative/screens/broadcast_screen.dart`: الربط البرمجي الشامل للبث الجماعي والسجل.
4. `mobile/lib/features/auth/screens/register_screen.dart`: الربط البرمجي الشامل لطلب الانضمام والتسجيل.

---

## 11. Architecture Preserved | البنية المعمارية المحفوظة بالكامل

- `GoRouter` وملاحة الشاشات والـ ShellRoute.
- `Provider` (AuthService, ScheduleService, ConnectivityService, ThemeProvider).
- `Hive` و `ScheduleCacheDao` و `SyncQueueDao`.
- `Dio` و `ApiClient` مع الترويسة الأوتوماتيكية لـ JWT `Authorization: Bearer <token>`.
- `FlutterSecureStorage` لتخزين مفاتيح الأمان.
- الهوية الرسمية الحقيقية لكلية المنار الجامعية والشعار المعتمد.

---

## 12. Mock Code Removed | الأكواد الوهمية التي تم التخلص منها

- ❌ `12 mock students` في شاشة الحضور.
- ❌ `Mock history list` في شاشة البث.
- ❌ `Future.delayed(const Duration(seconds: 2))` في شاشات الحضور والبث والتسجيل.

---

## 13. Remaining Mock Features | الميزات المتبقية (خارج نطاق P0)

- لا توجد ميزات شاشات رئيسية محاكاة في نطاق P0.
- ميزات P1 القادمة تشمل: نافذة التحديث بداخل التطبيق (`UpdateDialog`).

---

## 14. Tests Performed | الاختبارات والتحقق المنفذ

1. **التحليل البرمجي:** مطابقة عقود البيانات الممررة مع السيرفر وتجنيب أخطاء Types.
2. **اختبار الهوية والأصول:** التحقق من عدم وجود أي خطأ في تحميل الصور أو الأصول.
3. **فحص الـ Interceptor:** التحقق من إرسال JWT Bearer Token تلقائياً في الترويسات لكافة طلبات الحضور والبث.

---

## 15. Errors & Handled Exceptions | معالجة الحالات والأخطاء

- **`401/403 Unauthorized`:** عرض رسالة توضح اقتصار صلاحيات الحضور والبث على المندوب المعين.
- **`Connection Error / Timeout`:** عرض تنبيه بإعادة المحاولة وفحص الاتصال بالإنترنت.
- **`Validation Errors`:** إظهار الأخطاء القادمة من السيرفر على الشاشات المعنية.

---

## 16. Final P0 Status | النتيجة النهائية للمرحلة P0

```text
================================================================================
                    P0 INTEGRATION STATUS: 100% CONNECTED
================================================================================
  Attendance Screen  ==> CONNECTED  (GET /rep/classmates & POST /rep/attendance)
  Broadcast Screen   ==> CONNECTED  (GET /rep/broadcasts & POST /rep/broadcast)
  Register Screen    ==> CONNECTED  (POST /api/auth/register)
================================================================================
```
